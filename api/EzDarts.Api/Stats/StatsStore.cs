using Azure;
using Azure.Data.Tables;
using EzDarts.Api.Storage;

namespace EzDarts.Api.Stats;

public interface IStatsStore
{
    Task<IReadOnlyList<PlayerStatsDto>> ListAsync(string householdId, CancellationToken cancellationToken);

    /// <summary>Adds each change to its row (negative to take a game back out).</summary>
    Task ApplyAsync(
        string householdId,
        IReadOnlyDictionary<StatsKey, StatsCounts> delta,
        CancellationToken cancellationToken);
}

/// <summary>
/// <c>PlayerStats</c> table: PartitionKey = household id, RowKey = <c>{playerId}|{game}|{week}</c>.
/// Rows are read, added to and written back with the ETag, retrying when another save got there
/// first, so two games saved at once both count.
/// </summary>
public class TableStatsStore(TableProvider tables) : IStatsStore
{
    public const int MaxAttempts = 5;

    private static readonly string[] Columns =
        ["Games", "Wins", "Darts", "Singles", "Doubles", "Triples", "Misses", "Points"];

    public async Task<IReadOnlyList<PlayerStatsDto>> ListAsync(
        string householdId, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.PlayerStats, cancellationToken);
        var rows = new List<PlayerStatsDto>();
        await foreach (var entity in table.QueryAsync<TableEntity>(
                           e => e.PartitionKey == householdId, cancellationToken: cancellationToken))
        {
            var key = StatsKey.FromRowKey(entity.RowKey);
            var counts = Read(entity);
            if (counts.IsZero)
            {
                continue;
            }

            rows.Add(new PlayerStatsDto(
                key.PlayerId, key.Game, key.Week, counts.Games, counts.Wins, counts.Darts,
                counts.Singles, counts.Doubles, counts.Triples, counts.Misses, counts.Points));
        }

        return rows;
    }

    public async Task ApplyAsync(
        string householdId,
        IReadOnlyDictionary<StatsKey, StatsCounts> delta,
        CancellationToken cancellationToken)
    {
        if (delta.Count == 0)
        {
            return;
        }

        var table = await tables.GetAsync(TableProvider.PlayerStats, cancellationToken);
        foreach (var (key, change) in delta)
        {
            await AddAsync(table, householdId, key, change, cancellationToken);
        }
    }

    private static async Task AddAsync(
        TableClient table, string householdId, StatsKey key, StatsCounts change, CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            if (await TryAddAsync(table, householdId, key, change, cancellationToken))
            {
                return;
            }
        }

        throw new InvalidOperationException(
            $"Stats row {key.RowKey} kept changing; gave up after {MaxAttempts} attempts.");
    }

    /// <returns><c>false</c> when another save changed the row first, so it must be read again.</returns>
    private static async Task<bool> TryAddAsync(
        TableClient table, string householdId, StatsKey key, StatsCounts change, CancellationToken cancellationToken)
    {
        var existing = await table.GetEntityIfExistsAsync<TableEntity>(
            householdId, key.RowKey, cancellationToken: cancellationToken);
        try
        {
            if (existing.HasValue && existing.Value is { } row)
            {
                await table.UpdateEntityAsync(
                    Write(householdId, key, Read(row).Plus(change)), row.ETag, TableUpdateMode.Replace,
                    cancellationToken);
            }
            else
            {
                await table.AddEntityAsync(Write(householdId, key, change), cancellationToken);
            }

            return true;
        }
        // 412: changed since it was read; 409: added since it was read.
        catch (RequestFailedException ex) when (ex.Status is 409 or 412)
        {
            return false;
        }
    }

    private static StatsCounts Read(TableEntity entity)
    {
        int Get(string column) => entity.GetInt32(column) ?? 0;
        return new StatsCounts(
            Get("Games"), Get("Wins"), Get("Darts"), Get("Singles"),
            Get("Doubles"), Get("Triples"), Get("Misses"), Get("Points"));
    }

    private static TableEntity Write(string householdId, StatsKey key, StatsCounts counts)
    {
        int[] values =
        [
            counts.Games, counts.Wins, counts.Darts, counts.Singles,
            counts.Doubles, counts.Triples, counts.Misses, counts.Points,
        ];
        var entity = new TableEntity(householdId, key.RowKey);
        for (var i = 0; i < Columns.Length; i++)
        {
            entity[Columns[i]] = values[i];
        }

        return entity;
    }
}
