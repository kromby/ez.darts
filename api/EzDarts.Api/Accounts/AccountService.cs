using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;

namespace EzDarts.Api.Accounts;

/// <summary>
/// Email and password accounts, one per household. Passwords are hashed with ASP.NET Core Identity's
/// <see cref="PasswordHasher{TUser}"/>; sessions are random 32-byte tokens of which only the SHA-256
/// is stored; repeated failed sign-ins lock the email out for a while, whether or not it has an account.
/// </summary>
public partial class AccountService(
    IUserStore users,
    ISessionStore sessions,
    ILoginAttemptStore attempts,
    IPasswordHasher<UserRecord> hasher,
    TimeProvider time)
{
    public const int MinPasswordLength = 8;
    public const int MaxPasswordLength = 128;
    public const int MaxEmailLength = 254;

    /// <summary>Failed sign-ins allowed within <see cref="FailureWindow"/> before a lockout.</summary>
    public const int MaxFailures = 5;

    public static readonly TimeSpan FailureWindow = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan LockoutTime = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan SessionLifetime = TimeSpan.FromDays(30);

    /// <summary>A session used with less than this left is extended to a full <see cref="SessionLifetime"/>.</summary>
    public static readonly TimeSpan RenewWhenLeft = TimeSpan.FromDays(15);

    // Verified against for unknown emails, so they take as long as a wrong password.
    private static readonly Lazy<string> DummyHash = new(() =>
        new PasswordHasher<UserRecord>().HashPassword(null!, "not-a-real-password"));

    public async Task<AccountResult> RegisterAsync(
        string? email, string? password, CancellationToken cancellationToken)
    {
        if (!IsEmail(email))
        {
            return AccountResult.Fail(AccountError.InvalidEmail);
        }

        if (!IsStrongEnough(password))
        {
            return AccountResult.Fail(AccountError.WeakPassword);
        }

        var normalized = Tokens.NormalizeEmail(email!);
        var key = Tokens.EmailKey(normalized);
        if (await users.GetAsync(key, cancellationToken) is not null)
        {
            return AccountResult.Fail(AccountError.EmailTaken);
        }

        var now = time.GetUtcNow();
        var user = new UserRecord(key, normalized, "", Guid.NewGuid().ToString("N"), now, now);
        user = user with { PasswordHash = hasher.HashPassword(user, password!) };
        if (!await users.TryAddAsync(user, cancellationToken))
        {
            return AccountResult.Fail(AccountError.EmailTaken);
        }

        return await StartSessionAsync(user, cancellationToken);
    }

    public async Task<AccountResult> LoginAsync(string? email, string? password, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrEmpty(password) || email.Length > MaxEmailLength ||
            password.Length > MaxPasswordLength)
        {
            return AccountResult.Fail(AccountError.InvalidCredentials);
        }

        var key = Tokens.EmailKey(email);
        var now = time.GetUtcNow();
        // Throttled by email whether or not it has an account, so a lockout tells nothing.
        var failed = await attempts.GetAsync(key, cancellationToken);
        if (failed?.LockedUntil > now)
        {
            return AccountResult.Fail(AccountError.LockedOut);
        }

        var user = await users.GetAsync(key, cancellationToken);
        var verdict = hasher.VerifyHashedPassword(user!, user?.PasswordHash ?? DummyHash.Value, password);
        if (user is null || verdict == PasswordVerificationResult.Failed)
        {
            await RecordFailureAsync(key, failed, now, cancellationToken);
            return AccountResult.Fail(AccountError.InvalidCredentials);
        }

        if (failed is not null)
        {
            await attempts.ClearAsync(key, cancellationToken);
        }

        user = user with { LastLoginAt = now };
        if (verdict == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user = user with { PasswordHash = hasher.HashPassword(user, password) };
        }

        await users.UpdateAsync(user, cancellationToken);
        return await StartSessionAsync(user, cancellationToken);
    }

    /// <summary>
    /// The live session for a cookie token, extended when it is getting old; <c>null</c> when there is
    /// none or it has expired.
    /// </summary>
    public async Task<SessionRecord?> FindSessionAsync(string? token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(token) || token.Length > 128)
        {
            return null;
        }

        var hash = Tokens.Hash(token);
        var session = await sessions.GetAsync(hash, cancellationToken);
        var now = time.GetUtcNow();
        if (session is null)
        {
            return null;
        }

        if (session.ExpiresAt <= now)
        {
            await sessions.DeleteAsync(hash, cancellationToken);
            return null;
        }

        if (session.ExpiresAt - now < RenewWhenLeft)
        {
            session = session with { ExpiresAt = now + SessionLifetime };
            await sessions.SaveAsync(session, cancellationToken);
        }

        return session;
    }

    public async Task<UserRecord?> FindUserAsync(string? token, CancellationToken cancellationToken)
    {
        var session = await FindSessionAsync(token, cancellationToken);
        return session is null ? null : await users.GetAsync(session.EmailKey, cancellationToken);
    }

    public async Task LogoutAsync(string? token, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrEmpty(token) && token.Length <= 128)
        {
            await sessions.DeleteAsync(Tokens.Hash(token), cancellationToken);
        }
    }

    /// <summary>Ends every session of the signed-in account, this one included.</summary>
    public async Task<bool> LogoutEverywhereAsync(string? token, CancellationToken cancellationToken)
    {
        var session = await FindSessionAsync(token, cancellationToken);
        if (session is null)
        {
            return false;
        }

        await sessions.DeleteForUserAsync(session.EmailKey, null, cancellationToken);
        return true;
    }

    /// <summary>Changes the password and signs out every other device.</summary>
    public async Task<AccountResult> ChangePasswordAsync(
        string? token, string? currentPassword, string? newPassword, CancellationToken cancellationToken)
    {
        var session = await FindSessionAsync(token, cancellationToken);
        var user = session is null ? null : await users.GetAsync(session.EmailKey, cancellationToken);
        if (session is null || user is null)
        {
            return AccountResult.Fail(AccountError.NoSession);
        }

        if (string.IsNullOrEmpty(currentPassword) || currentPassword.Length > MaxPasswordLength ||
            hasher.VerifyHashedPassword(user, user.PasswordHash, currentPassword) ==
            PasswordVerificationResult.Failed)
        {
            return AccountResult.Fail(AccountError.WrongPassword);
        }

        if (!IsStrongEnough(newPassword))
        {
            return AccountResult.Fail(AccountError.WeakPassword);
        }

        user = user with { PasswordHash = hasher.HashPassword(user, newPassword!) };
        await users.UpdateAsync(user, cancellationToken);
        await sessions.DeleteForUserAsync(user.EmailKey, session.TokenHash, cancellationToken);
        return new AccountResult(AccountError.None, user);
    }

    private async Task<AccountResult> StartSessionAsync(UserRecord user, CancellationToken cancellationToken)
    {
        var token = Tokens.NewSessionToken();
        var now = time.GetUtcNow();
        await sessions.SaveAsync(
            new SessionRecord(Tokens.Hash(token), user.EmailKey, user.HouseholdId, now, now + SessionLifetime),
            cancellationToken);
        return new AccountResult(AccountError.None, user, token);
    }

    private async Task RecordFailureAsync(
        string key, LoginAttempts? previous, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var inWindow = previous?.FirstFailureAt is { } first && now - first < FailureWindow;
        var failures = inWindow ? previous!.Failures + 1 : 1;
        var firstFailure = inWindow ? previous!.FirstFailureAt : now;
        var next = failures >= MaxFailures
            ? new LoginAttempts(0, null, now + LockoutTime)
            : new LoginAttempts(failures, firstFailure, null);
        await attempts.SaveAsync(key, next, cancellationToken);
    }

    public static bool IsEmail(string? email) =>
        email is not null && email.Trim().Length <= MaxEmailLength && Email().IsMatch(email.Trim());

    /// <summary>Length only, as current advice has it: no rules about digits or symbols.</summary>
    public static bool IsStrongEnough(string? password) =>
        password is not null && password.Length is >= MinPasswordLength and <= MaxPasswordLength &&
        !string.IsNullOrWhiteSpace(password);

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex Email();
}
