using Azure;
using Azure.Data.Tables;
using EzDarts.Api.Storage;

namespace EzDarts.Api.Players;

/// <summary>A household player, as the web app's <c>Player</c> type.</summary>
public record PlayerDto(string Id, string Name, string? Color = null, string? ArchivedAt = null);

/// <summary>The household's players. Removing one archives it (<c>ArchivedAt</c>), so nothing is deleted.</summary>
public interface IPlayerStore
{
    Task<IReadOnlyList<PlayerDto>> ListAsync(string householdId, CancellationToken cancellationToken);

    /// <returns><c>true</c> when the player is new, <c>false</c> when an existing one was replaced.</returns>
    Task<bool> UpsertAsync(string householdId, PlayerDto player, CancellationToken cancellationToken);
}

/// <summary><c>Players</c> table: PartitionKey = household id, RowKey = player id.</summary>
public class TablePlayerStore(TableProvider tables) : IPlayerStore
{
    public async Task<IReadOnlyList<PlayerDto>> ListAsync(string householdId, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Players, cancellationToken);
        var players = new List<PlayerDto>();
        await foreach (var entity in table.QueryAsync<TableEntity>(
                           e => e.PartitionKey == householdId, cancellationToken: cancellationToken))
        {
            players.Add(new PlayerDto(
                entity.RowKey,
                entity.GetString("Name") ?? "",
                entity.GetString("Color"),
                entity.GetString("ArchivedAt")));
        }

        return players;
    }

    public async Task<bool> UpsertAsync(string householdId, PlayerDto player, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Players, cancellationToken);
        var entity = new TableEntity(householdId, player.Id)
        {
            ["Name"] = player.Name,
            ["Color"] = player.Color,
            ["ArchivedAt"] = player.ArchivedAt,
        };
        try
        {
            await table.AddEntityAsync(entity, cancellationToken);
            return true;
        }
        catch (RequestFailedException ex) when (ex.Status == 409)
        {
            await table.UpsertEntityAsync(entity, TableUpdateMode.Replace, cancellationToken);
            return false;
        }
    }
}
