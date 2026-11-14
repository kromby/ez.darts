namespace EzDarts.Api.Accounts;

/// <summary>
/// A household's account: one per household, signed in with email and password.
/// <c>EmailKey</c> is <see cref="Tokens.EmailKey"/> of the email, so the address itself never has to
/// be a table key.
/// </summary>
public record UserRecord(
    string EmailKey,
    string Email,
    string PasswordHash,
    string HouseholdId,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LastLoginAt = null);

/// <summary>A signed-in device. Only the SHA-256 of its cookie token is stored.</summary>
public record SessionRecord(
    string TokenHash,
    string EmailKey,
    string HouseholdId,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt);

/// <summary>Failed sign-ins for one email address, known or not, and any lockout.</summary>
public record LoginAttempts(int Failures, DateTimeOffset? FirstFailureAt, DateTimeOffset? LockedUntil);

public record CredentialsRequest(string? Email, string? Password);

public record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

/// <summary>Who is signed in, as the web app needs it.</summary>
public record AccountResponse(string Email, string HouseholdId);

public enum AccountError
{
    None,
    InvalidEmail,
    WeakPassword,
    EmailTaken,

    /// <summary>The one answer for an unknown email and a wrong password alike.</summary>
    InvalidCredentials,

    /// <summary>Too many failures for this email; the same for known and unknown addresses.</summary>
    LockedOut,
    WrongPassword,
    NoSession,
}

/// <summary>An account call's outcome: a new session token, the account, or what went wrong.</summary>
public record AccountResult(AccountError Error, UserRecord? User = null, string? Token = null)
{
    public bool Succeeded => Error == AccountError.None;

    public static AccountResult Fail(AccountError error) => new(error);
}
