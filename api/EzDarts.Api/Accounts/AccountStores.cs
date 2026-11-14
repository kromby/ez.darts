using Azure;
using Azure.Data.Tables;
using EzDarts.Api.Storage;

namespace EzDarts.Api.Accounts;

public interface IUserStore
{
    Task<UserRecord?> GetAsync(string emailKey, CancellationToken cancellationToken);

    /// <returns><c>false</c> when the email already has an account.</returns>
    Task<bool> TryAddAsync(UserRecord user, CancellationToken cancellationToken);

    Task UpdateAsync(UserRecord user, CancellationToken cancellationToken);
}

public interface ISessionStore
{
    Task<SessionRecord?> GetAsync(string tokenHash, CancellationToken cancellationToken);

    /// <summary>Creates or replaces the session.</summary>
    Task SaveAsync(SessionRecord session, CancellationToken cancellationToken);

    Task DeleteAsync(string tokenHash, CancellationToken cancellationToken);

    /// <summary>Signs a user out everywhere, except the session given, if any.</summary>
    Task DeleteForUserAsync(string emailKey, string? exceptTokenHash, CancellationToken cancellationToken);
}

public interface ILoginAttemptStore
{
    Task<LoginAttempts?> GetAsync(string emailKey, CancellationToken cancellationToken);

    Task SaveAsync(string emailKey, LoginAttempts attempts, CancellationToken cancellationToken);

    Task ClearAsync(string emailKey, CancellationToken cancellationToken);
}

/// <summary><c>Users</c> table: PartitionKey <c>user</c>, RowKey = email key.</summary>
public class TableUserStore(TableProvider tables) : IUserStore
{
    public const string Partition = "user";

    public async Task<UserRecord?> GetAsync(string emailKey, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Users, cancellationToken);
        var found = await table.GetEntityIfExistsAsync<TableEntity>(
            Partition, emailKey, cancellationToken: cancellationToken);
        return found.HasValue && found.Value is { } entity ? Read(entity) : null;
    }

    public async Task<bool> TryAddAsync(UserRecord user, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Users, cancellationToken);
        try
        {
            await table.AddEntityAsync(Write(user), cancellationToken);
            return true;
        }
        catch (RequestFailedException ex) when (ex.Status == 409)
        {
            return false;
        }
    }

    public async Task UpdateAsync(UserRecord user, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Users, cancellationToken);
        await table.UpsertEntityAsync(Write(user), TableUpdateMode.Replace, cancellationToken);
    }

    public static TableEntity Write(UserRecord user) => new(Partition, user.EmailKey)
    {
        ["Email"] = user.Email,
        ["PasswordHash"] = user.PasswordHash,
        ["HouseholdId"] = user.HouseholdId,
        ["CreatedAt"] = user.CreatedAt,
        ["LastLoginAt"] = user.LastLoginAt,
    };

    public static UserRecord Read(TableEntity entity) => new(
        entity.RowKey,
        entity.GetString("Email") ?? "",
        entity.GetString("PasswordHash") ?? "",
        entity.GetString("HouseholdId") ?? "",
        entity.GetDateTimeOffset("CreatedAt") ?? DateTimeOffset.MinValue,
        entity.GetDateTimeOffset("LastLoginAt"));
}

/// <summary><c>Sessions</c> table: PartitionKey <c>session</c>, RowKey = SHA-256 of the token.</summary>
public class TableSessionStore(TableProvider tables) : ISessionStore
{
    public const string Partition = "session";

    public async Task<SessionRecord?> GetAsync(string tokenHash, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Sessions, cancellationToken);
        var found = await table.GetEntityIfExistsAsync<TableEntity>(
            Partition, tokenHash, cancellationToken: cancellationToken);
        return found.HasValue && found.Value is { } entity ? Read(entity) : null;
    }

    public async Task SaveAsync(SessionRecord session, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Sessions, cancellationToken);
        await table.UpsertEntityAsync(Write(session), TableUpdateMode.Replace, cancellationToken);
    }

    public async Task DeleteAsync(string tokenHash, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Sessions, cancellationToken);
        await table.DeleteEntityAsync(Partition, tokenHash, cancellationToken: cancellationToken);
    }

    public async Task DeleteForUserAsync(
        string emailKey, string? exceptTokenHash, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.Sessions, cancellationToken);
        // A household has a handful of devices; the filter keeps the scan to its own rows.
        var filter = TableClient.CreateQueryFilter($"PartitionKey eq {Partition} and EmailKey eq {emailKey}");
        await foreach (var entity in table.QueryAsync<TableEntity>(filter, cancellationToken: cancellationToken))
        {
            if (entity.RowKey != exceptTokenHash)
            {
                await table.DeleteEntityAsync(Partition, entity.RowKey, cancellationToken: cancellationToken);
            }
        }
    }

    public static TableEntity Write(SessionRecord session) => new(Partition, session.TokenHash)
    {
        ["EmailKey"] = session.EmailKey,
        ["HouseholdId"] = session.HouseholdId,
        ["CreatedAt"] = session.CreatedAt,
        ["ExpiresAt"] = session.ExpiresAt,
    };

    public static SessionRecord Read(TableEntity entity) => new(
        entity.RowKey,
        entity.GetString("EmailKey") ?? "",
        entity.GetString("HouseholdId") ?? "",
        entity.GetDateTimeOffset("CreatedAt") ?? DateTimeOffset.MinValue,
        entity.GetDateTimeOffset("ExpiresAt") ?? DateTimeOffset.MinValue);
}

/// <summary><c>LoginAttempts</c> table: PartitionKey <c>email</c>, RowKey = email key.</summary>
public class TableLoginAttemptStore(TableProvider tables) : ILoginAttemptStore
{
    public const string Partition = "email";

    public async Task<LoginAttempts?> GetAsync(string emailKey, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.LoginAttempts, cancellationToken);
        var found = await table.GetEntityIfExistsAsync<TableEntity>(
            Partition, emailKey, cancellationToken: cancellationToken);
        return found.HasValue && found.Value is { } entity
            ? new LoginAttempts(
                entity.GetInt32("Failures") ?? 0,
                entity.GetDateTimeOffset("FirstFailureAt"),
                entity.GetDateTimeOffset("LockedUntil"))
            : null;
    }

    public async Task SaveAsync(string emailKey, LoginAttempts attempts, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.LoginAttempts, cancellationToken);
        await table.UpsertEntityAsync(
            new TableEntity(Partition, emailKey)
            {
                ["Failures"] = attempts.Failures,
                ["FirstFailureAt"] = attempts.FirstFailureAt,
                ["LockedUntil"] = attempts.LockedUntil,
            },
            TableUpdateMode.Replace,
            cancellationToken);
    }

    public async Task ClearAsync(string emailKey, CancellationToken cancellationToken)
    {
        var table = await tables.GetAsync(TableProvider.LoginAttempts, cancellationToken);
        await table.DeleteEntityAsync(Partition, emailKey, cancellationToken: cancellationToken);
    }
}
