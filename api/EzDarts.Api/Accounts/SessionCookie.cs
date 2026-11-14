using Microsoft.AspNetCore.Http;

namespace EzDarts.Api.Accounts;

/// <summary>
/// The session cookie. Static Web Apps keeps <c>/.auth/*</c> and its own <c>StaticWebAppsAuthCookie</c>
/// and <c>AppServiceAuthSession</c> cookies to itself, so ours has its own name and is only sent to
/// <c>/api</c>.
/// </summary>
public static class SessionCookie
{
    public const string Name = "ezd_session";
    public const string Path = "/api";

    public static string? Read(HttpRequest request) =>
        request.Cookies.TryGetValue(Name, out var value) ? value : null;

    /// <summary>HttpOnly, Secure and SameSite=Lax, lasting as long as the session.</summary>
    public static void Write(HttpResponse response, string token, TimeSpan lifetime) =>
        response.Cookies.Append(Name, token, Options(lifetime));

    public static void Clear(HttpResponse response) =>
        response.Cookies.Append(Name, "", Options(TimeSpan.Zero));

    private static CookieOptions Options(TimeSpan lifetime) => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Lax,
        Path = Path,
        MaxAge = lifetime,
        IsEssential = true,
    };
}

/// <summary>
/// Refuses state-changing requests sent from another site's page, on top of SameSite=Lax. Browsers
/// say where a request comes from in <c>Sec-Fetch-Site</c>, which pages can't set and proxies leave
/// alone; only <c>same-origin</c> passes. Browsers too old to send it are checked by <c>Origin</c>
/// against the host the request was sent to.
/// </summary>
public static class OriginCheck
{
    public static bool IsSameOrigin(HttpRequest request)
    {
        var site = request.Headers["Sec-Fetch-Site"].ToString();
        if (site.Length > 0)
        {
            // "none": typed or bookmarked by the user themself, never another page.
            return site is "same-origin" or "none";
        }

        var origin = request.Headers.Origin.ToString();
        if (origin.Length == 0)
        {
            // Not from a browser page (browsers always send Origin on POST, PUT and DELETE).
            return true;
        }

        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
        {
            // Includes "null", sent from sandboxed frames and some redirects.
            return false;
        }

        var host = uri.IsDefaultPort ? uri.Host : $"{uri.Host}:{uri.Port}";
        // Static Web Apps forwards the visitor's host in X-Forwarded-Host.
        var forwarded = request.Headers["X-Forwarded-Host"].ToString().Split(',')[0].Trim();
        return string.Equals(host, request.Host.Value, StringComparison.OrdinalIgnoreCase) ||
               (forwarded.Length > 0 && string.Equals(host, forwarded, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>GET and HEAD change nothing, so only the others are checked.</summary>
    public static bool IsSafeMethod(HttpRequest request) =>
        HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method);
}
