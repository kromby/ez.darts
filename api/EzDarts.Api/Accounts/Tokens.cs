using System.Security.Cryptography;
using System.Text;

namespace EzDarts.Api.Accounts;

public static class Tokens
{
    /// <summary>Bytes of randomness in a session token.</summary>
    public const int TokenBytes = 32;

    /// <summary>A new session token: 32 random bytes, base64url (43 characters).</summary>
    public static string NewSessionToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(TokenBytes))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    /// <summary>SHA-256 of a token, hex: all the server keeps of it.</summary>
    public static string Hash(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    /// <summary>Trimmed and lower-cased, so "Anna@Example.com " and "anna@example.com" are one account.</summary>
    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    /// <summary>
    /// The table key for an email: SHA-256 of the normalised address, as an email may hold characters a
    /// table key can't (<c>/</c>, <c>#</c>, <c>?</c>).
    /// </summary>
    public static string EmailKey(string email) => Hash(NormalizeEmail(email));
}
