using System.Globalization;
using System.Text.Json;
using Azure;
using Azure.Data.Tables;
using EzDarts.Api.Http;
using EzDarts.Api.Stats;
using EzDarts.Api.Storage;

namespace EzDarts.Api.Games;

/// <summary>A stored game and the stats it has added so far (<c>null</c>: none).</summary>
public record StoredGame(GameDto Game, StatsSource? StatsApplied);

public interface IGameStore
{
    Task<StoredGame?> GetAsync(string householdId, string id, CancellationToken cancellationToken);

    /// <summary>Every game, newest first.</summary>
    Task<IReadOnlyList<GameDto>> ListAsync(string householdId, CancellationToken cancellationToken);

    /// <summary>Creates or replaces the game, keeping <paramref name="statsApplied"/> with it.</summary>
    Task SaveAsync(
        string householdId, GameDto game, StatsSource? statsApplied, CancellationToken cancellationToken);

    /// <summary>Records which stats the game has added, once they are.</summary>
    Task SetStatsAppliedAsync(
        string householdId, string id, StatsSource? statsApplied, CancellationToken cancellationToken);

    Task DeleteAsync(string householdId, string id, CancellationToken cancellationToken);
}

/// <summary>
/// <c>Games</c> table: PartitionKey = household id, RowKey = game id. Options, slots, result and
/// summary are JSON columns; the dart log is compact (<see cref="DartLog"/>) in <c>Darts0</c>,
/// <c>Darts1</c> … chunks.
/// </summary>
public class TableGameStore(TableProvider tables) : IGameStore
{
    private const string DartsPrefix = "Darts";

    public async Task<StoredGame?> GetAsync(string householdId, string id, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Games, cancellationToken);
        var entity = await table.GetEntityIfExistsAsync<TableEntity>(
            householdId, id, cancellationToken: cancellationToken);
        return entity.HasValue && entity.Value is { } found ? Read(found) : null;
    }

    public async Task<IReadOnlyList<GameDto>> ListAsync(string householdId, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Games, cancellationToken);
        var games = new List<GameDto>();
        await foreach (var entity in table.QueryAsync<TableEntity>(
                           e => e.PartitionKey == householdId, cancellationToken: cancellationToken))
        {
            games.Add(Read(entity).Game);
        }

        // ISO 8601 times sort as text.
        return games.OrderByDescending(g => g.StartedAt, StringComparer.Ordinal).ToList();
    }

    public async Task SaveAsync(
        string householdId, GameDto game, StatsSource? statsApplied, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Games, cancellationToken);
        await table.UpsertEntityAsync(Write(householdId, game, statsApplied), TableUpdateMode.Replace,
            cancellationToken);
    }

    public async Task SetStatsAppliedAsync(
        string householdId, string id, StatsSource? statsApplied, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Games, cancellationToken);
        var entity = new TableEntity(householdId, id) { ["StatsApplied"] = ToJson(statsApplied) };
        await table.UpdateEntityAsync(entity, ETag.All, TableUpdateMode.Merge, cancellationToken);
    }

    public async Task DeleteAsync(string householdId, string id, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Games, cancellationToken);
        await table.DeleteEntityAsync(householdId, id, cancellationToken: cancellationToken);
    }

    public static TableEntity Write(string householdId, GameDto game, StatsSource? statsApplied)
    {
        var chunks = DartLog.Chunk(DartLog.Encode(game.Darts, game.Slots));
        var entity = new TableEntity(householdId, game.Id)
        {
            ["Game"] = game.Game,
            ["ConfigVersion"] = game.ConfigVersion,
            ["Options"] = game.Options.GetRawText(),
            ["Slots"] = ToJson(game.Slots),
            ["DartCount"] = game.Darts.Count,
            ["DartChunks"] = chunks.Count,
            ["StartedAt"] = game.StartedAt,
            ["Finished"] = game.Result is not null,
            ["Result"] = ToJson(game.Result),
            ["Summary"] = ToJson(game.Summary),
            ["StatsApplied"] = ToJson(statsApplied),
        };
        for (var i = 0; i < chunks.Count; i++)
        {
            entity[DartsPrefix + i.ToString(CultureInfo.InvariantCulture)] = chunks[i];
        }

        return entity;
    }

    public static StoredGame Read(TableEntity entity)
    {
        var slots = FromJson<List<SlotDto>>(entity.GetString("Slots")) ?? [];
        var chunkCount = entity.GetInt32("DartChunks") ?? 0;
        var encoded = string.Concat(Enumerable.Range(0, chunkCount)
            .Select(i => entity.GetString(DartsPrefix + i.ToString(CultureInfo.InvariantCulture))));
        using var options = JsonDocument.Parse(entity.GetString("Options") ?? "{}");
        var game = new GameDto(
            entity.RowKey,
            entity.GetString("Game") ?? "",
            entity.GetInt32("ConfigVersion") ?? 1,
            options.RootElement.Clone(),
            slots,
            DartLog.Decode(encoded, slots),
            entity.GetString("StartedAt") ?? "",
            FromJson<GameResultDto>(entity.GetString("Result")),
            FromJson<List<PlayerSummaryDto>>(entity.GetString("Summary")));
        return new StoredGame(game, FromJson<StatsSource>(entity.GetString("StatsApplied")));
    }

    private static string? ToJson<T>(T? value) =>
        value is null ? null : JsonSerializer.Serialize(value, ApiJson.Options);

    private static T? FromJson<T>(string? json) where T : class =>
        json is null ? null : JsonSerializer.Deserialize<T>(json, ApiJson.Options);
}
