using EzDarts.Api.Accounts;
using Microsoft.AspNetCore.Identity;

namespace EzDarts.Api.Tests;

/// <summary>A clock the tests move by hand.</summary>
internal sealed class TestClock(DateTimeOffset start) : TimeProvider
{
    public DateTimeOffset Now { get; set; } = start;

    public override DateTimeOffset GetUtcNow() => Now;

    public void Advance(TimeSpan by) => Now += by;
}

internal sealed class MemoryUserStore : IUserStore
{
    public Dictionary<string, UserRecord> Users { get; } = [];

    public Task<UserRecord?> GetAsync(string emailKey, CancellationToken cancellationToken) =>
        Task.FromResult(Users.GetValueOrDefault(emailKey));

    public Task<bool> TryAddAsync(UserRecord user, CancellationToken cancellationToken) =>
        Task.FromResult(Users.TryAdd(user.EmailKey, user));

    public Task UpdateAsync(UserRecord user, CancellationToken cancellationToken)
    {
        Users[user.EmailKey] = user;
        return Task.CompletedTask;
    }
}

internal sealed class MemorySessionStore : ISessionStore
{
    public Dictionary<string, SessionRecord> Sessions { get; } = [];

    public Task<SessionRecord?> GetAsync(string tokenHash, CancellationToken cancellationToken) =>
        Task.FromResult(Sessions.GetValueOrDefault(tokenHash));

    public Task SaveAsync(SessionRecord session, CancellationToken cancellationToken)
    {
        Sessions[session.TokenHash] = session;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string tokenHash, CancellationToken cancellationToken)
    {
        Sessions.Remove(tokenHash);
        return Task.CompletedTask;
    }

    public Task DeleteForUserAsync(string emailKey, string? exceptTokenHash, CancellationToken cancellationToken)
    {
        foreach (var hash in Sessions.Values
                     .Where(s => s.EmailKey == emailKey && s.TokenHash != exceptTokenHash)
                     .Select(s => s.TokenHash)
                     .ToList())
        {
            Sessions.Remove(hash);
        }

        return Task.CompletedTask;
    }
}

internal sealed class MemoryLoginAttemptStore : ILoginAttemptStore
{
    public Dictionary<string, LoginAttempts> Attempts { get; } = [];

    public Task<LoginAttempts?> GetAsync(string emailKey, CancellationToken cancellationToken) =>
        Task.FromResult(Attempts.GetValueOrDefault(emailKey));

    public Task SaveAsync(string emailKey, LoginAttempts attempts, CancellationToken cancellationToken)
    {
        Attempts[emailKey] = attempts;
        return Task.CompletedTask;
    }

    public Task ClearAsync(string emailKey, CancellationToken cancellationToken)
    {
        Attempts.Remove(emailKey);
        return Task.CompletedTask;
    }
}

/// <summary>An account service on memory stores and the real password hasher.</summary>
internal sealed class TestAccounts
{
    public TestClock Clock { get; } = new(new DateTimeOffset(2026, 11, 14, 20, 0, 0, TimeSpan.Zero));
    public MemoryUserStore Users { get; } = new();
    public MemorySessionStore Sessions { get; } = new();
    public MemoryLoginAttemptStore Attempts { get; } = new();
    public PasswordHasher<UserRecord> Hasher { get; } = new();

    public AccountService Service => new(Users, Sessions, Attempts, Hasher, Clock);
}
