using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;

namespace EzDarts.Api.Households;

/// <summary>
/// Finds the household a request is signed in to. Every players, games and stats endpoint asks this
/// first and only touches that household's rows. Sign-in (#19) replaces the registered implementation
/// with one that reads the session cookie; nothing else changes.
/// </summary>
public interface IHouseholdResolver
{
    /// <returns>The caller's household id, or <c>null</c> when there is no valid session.</returns>
    Task<string?> ResolveAsync(HttpRequest request, CancellationToken cancellationToken);
}

/// <summary>
/// Used until sign-in exists: nobody has a session, so every household endpoint answers 401.
/// </summary>
public sealed class NoSessionHouseholdResolver : IHouseholdResolver
{
    public Task<string?> ResolveAsync(HttpRequest request, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(null);
}

/// <summary>
/// Local development only: trusts an <c>X-Household-Id</c> header so the endpoints can be tried
/// against Azurite before sign-in exists. Never registered outside the Development environment.
/// </summary>
public sealed partial class DevHeaderHouseholdResolver : IHouseholdResolver
{
    public const string HeaderName = "X-Household-Id";

    public Task<string?> ResolveAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        var value = request.Headers[HeaderName].ToString();
        return Task.FromResult(HouseholdId().IsMatch(value) ? value : null);
    }

    [GeneratedRegex("^[A-Za-z0-9-]{1,64}$")]
    private static partial Regex HouseholdId();
}
