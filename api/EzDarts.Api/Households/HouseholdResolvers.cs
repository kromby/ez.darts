using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;

namespace EzDarts.Api.Households;

/// <summary>
/// Finds the household a request is signed in to. Every players, games and stats endpoint asks this
/// first and only touches that household's rows.
/// </summary>
public interface IHouseholdResolver
{
    /// <returns>The caller's household id, or <c>null</c> when there is no valid session.</returns>
    Task<string?> ResolveAsync(HttpRequest request, CancellationToken cancellationToken);
}

/// <summary>
/// Local development only: trusts an <c>X-Household-Id</c> header so the endpoints can be tried
/// against Azurite without signing in. Never registered outside the Development environment.
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

/// <summary>
/// The signed-in household from the session cookie (#19). A request that changes something must also
/// come from this site's own pages (<see cref="Accounts.OriginCheck"/>).
/// </summary>
public sealed class SessionHouseholdResolver(Accounts.AccountService accounts) : IHouseholdResolver
{
    public async Task<string?> ResolveAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        if (!Accounts.OriginCheck.IsSafeMethod(request) && !Accounts.OriginCheck.IsSameOrigin(request))
        {
            return null;
        }

        var session = await accounts.FindSessionAsync(Accounts.SessionCookie.Read(request), cancellationToken);
        return session?.HouseholdId;
    }
}

/// <summary>Asks each resolver in turn; the first household found wins.</summary>
public sealed class FirstHouseholdResolver(params IHouseholdResolver[] resolvers) : IHouseholdResolver
{
    public async Task<string?> ResolveAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        foreach (var resolver in resolvers)
        {
            if (await resolver.ResolveAsync(request, cancellationToken) is { } household)
            {
                return household;
            }
        }

        return null;
    }
}
