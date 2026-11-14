using System.Collections.Concurrent;
using Azure.Data.Tables;

namespace EzDarts.Api.Storage;

/// <summary>
/// Hands out table clients, creating each table the first time it is used (infra/main.bicep creates
/// them in Azure; this covers Azurite and new environments). A failed create is retried next time.
/// </summary>
public class TableProvider(TableServiceClient service)
{
    public const string Players = "Players";
    public const string Games = "Games";
    public const string PlayerStats = "PlayerStats";
    public const string Users = "Users";
    public const string Sessions = "Sessions";
    public const string LoginAttempts = "LoginAttempts";

    private readonly ConcurrentDictionary<string, TableClient> _ready = new();

    public virtual async Task<TableClient> GetAsync(string name, CancellationToken cancellationToken)
    {
        if (_ready.TryGetValue(name, out var ready))
        {
            return ready;
        }

        var table = service.GetTableClient(name);
        await table.CreateIfNotExistsAsync(cancellationToken);
        return _ready.GetOrAdd(name, table);
    }
}
