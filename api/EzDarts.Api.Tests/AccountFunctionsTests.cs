using System.Text;
using System.Text.Json;
using EzDarts.Api.Accounts;
using EzDarts.Api.Households;
using EzDarts.Api.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using static EzDarts.Api.Tests.TestRequests;

namespace EzDarts.Api.Tests;

public class AccountFunctionsTests
{
    private const string Password = "correct horse battery";
    private readonly TestAccounts _accounts = new();
    private AccountFunctions Functions => new(_accounts.Service);
    private static readonly CancellationToken None = CancellationToken.None;

    /// <summary>A POST from the app on https://darts.example, with a body and maybe a cookie.</summary>
    private static HttpRequest Post(object? body = null, string? cookie = null, string? origin = "https://darts.example")
    {
        var context = new DefaultHttpContext();
        var request = context.Request;
        request.Method = "POST";
        request.Scheme = "https";
        request.Host = new HostString("darts.example");
        if (origin is not null)
        {
            request.Headers.Origin = origin;
        }

        if (cookie is not null)
        {
            request.Headers.Cookie = $"{SessionCookie.Name}={cookie}";
        }

        request.Body = new MemoryStream(Encoding.UTF8.GetBytes(
            body is null ? "" : JsonSerializer.Serialize(body, ApiJson.Options)));
        return request;
    }

    private static HttpRequest Get(string? cookie = null)
    {
        var request = Post(cookie: cookie, origin: null);
        request.Method = "GET";
        return request;
    }

    private static string SetCookie(HttpRequest request) =>
        request.HttpContext.Response.Headers.SetCookie.ToString();

    private static string TokenFrom(HttpRequest request)
    {
        var header = SetCookie(request);
        var start = header.IndexOf('=') + 1;
        return header[start..header.IndexOf(';')];
    }

    private async Task<string> RegisterAsync()
    {
        var request = Post(new CredentialsRequest("anna@example.com", Password));
        await Functions.RegisterAsync(request, None);
        return TokenFrom(request);
    }

    [Fact]
    public async Task Register_SetsAnHttpOnlySecureLaxCookieForTheApiOnlyAsync()
    {
        var request = Post(new CredentialsRequest("anna@example.com", Password));

        var (status, body) = Json<AccountResponse>(await Functions.RegisterAsync(request, None));

        Assert.Equal(StatusCodes.Status201Created, status);
        Assert.Equal("anna@example.com", body.Email);
        var cookie = SetCookie(request).ToLowerInvariant();
        Assert.StartsWith($"{SessionCookie.Name}=", cookie);
        Assert.Contains("httponly", cookie);
        Assert.Contains("secure", cookie);
        Assert.Contains("samesite=lax", cookie);
        Assert.Contains("path=/api", cookie);
        Assert.Contains($"max-age={(int)AccountService.SessionLifetime.TotalSeconds}", cookie);
    }

    [Fact]
    public async Task Register_CookieHoldsA32ByteTokenAsync()
    {
        var token = await RegisterAsync();

        var bytes = Convert.FromBase64String(token.Replace('-', '+').Replace('_', '/') + "=");
        Assert.Equal(Tokens.TokenBytes, bytes.Length);
        // The cookie name stays clear of Static Web Apps' own.
        Assert.DoesNotContain("StaticWebApps", SessionCookie.Name);
        Assert.DoesNotContain("AppServiceAuth", SessionCookie.Name);
    }

    [Fact]
    public async Task Login_ReturnsTheSame401ForUnknownEmailAndWrongPasswordAsync()
    {
        await RegisterAsync();

        var wrong = Json<ErrorResponse>(await Functions.LoginAsync(
            Post(new CredentialsRequest("anna@example.com", "wrong password")), None));
        var unknown = Json<ErrorResponse>(await Functions.LoginAsync(
            Post(new CredentialsRequest("nobody@example.com", Password)), None));

        Assert.Equal(StatusCodes.Status401Unauthorized, wrong.Status);
        Assert.Equal(wrong, unknown);
    }

    [Fact]
    public async Task Login_Answers429WhenLockedOutAsync()
    {
        for (var i = 0; i < AccountService.MaxFailures; i++)
        {
            await Functions.LoginAsync(Post(new CredentialsRequest("anna@example.com", "guess")), None);
        }

        var (status, error) = Json<ErrorResponse>(await Functions.LoginAsync(
            Post(new CredentialsRequest("anna@example.com", "guess")), None));

        Assert.Equal(StatusCodes.Status429TooManyRequests, status);
        Assert.Equal("locked-out", error.Code);
    }

    [Theory]
    [InlineData("https://evil.example")]
    [InlineData("https://darts.example.evil.example")]
    [InlineData("null")]
    public async Task StateChangingCalls_RefuseOtherOriginsAsync(string origin)
    {
        var token = await RegisterAsync();
        var functions = Functions;

        IActionResult[] results =
        [
            await functions.RegisterAsync(Post(new CredentialsRequest("oli@example.com", Password), origin: origin), None),
            await functions.LoginAsync(Post(new CredentialsRequest("anna@example.com", Password), origin: origin), None),
            await functions.LogoutAsync(Post(cookie: token, origin: origin), None),
            await functions.LogoutEverywhereAsync(Post(cookie: token, origin: origin), None),
            await functions.ChangePasswordAsync(
                Post(new ChangePasswordRequest(Password, "a new password"), token, origin), None),
        ];

        Assert.All(results, result => Assert.Equal(StatusCodes.Status403Forbidden, Status(result)));
        Assert.Single(_accounts.Users.Users);
        Assert.NotNull(await _accounts.Service.FindSessionAsync(token, None));
    }

    [Fact]
    public async Task Me_SaysWhoIsSignedInOr401Async()
    {
        var token = await RegisterAsync();

        var (status, me) = Json<AccountResponse>(await Functions.MeAsync(Get(token), None));
        var nobody = await Functions.MeAsync(Get(), None);

        Assert.Equal(StatusCodes.Status200OK, status);
        Assert.Equal("anna@example.com", me.Email);
        Assert.Equal(StatusCodes.Status401Unauthorized, Status(nobody));
    }

    [Fact]
    public async Task Logout_EndsTheSessionAndClearsTheCookieAsync()
    {
        var token = await RegisterAsync();
        var request = Post(cookie: token);

        var result = await Functions.LogoutAsync(request, None);

        Assert.Equal(StatusCodes.Status204NoContent, Status(result));
        Assert.Contains("max-age=0", SetCookie(request).ToLowerInvariant());
        Assert.Equal(StatusCodes.Status401Unauthorized, Status(await Functions.MeAsync(Get(token), None)));
    }

    [Fact]
    public async Task LogoutEverywhere_EndsEverySessionAsync()
    {
        var first = await RegisterAsync();
        var login = Post(new CredentialsRequest("anna@example.com", Password));
        await Functions.LoginAsync(login, None);
        var second = TokenFrom(login);

        var result = await Functions.LogoutEverywhereAsync(Post(cookie: first), None);

        Assert.Equal(StatusCodes.Status204NoContent, Status(result));
        Assert.Equal(StatusCodes.Status401Unauthorized, Status(await Functions.MeAsync(Get(second), None)));
    }

    [Fact]
    public async Task ChangePassword_ReportsAWrongCurrentPasswordAsync()
    {
        var token = await RegisterAsync();

        var (status, error) = Json<ErrorResponse>(await Functions.ChangePasswordAsync(
            Post(new ChangePasswordRequest("wrong password", "a new password"), token), None));
        var done = await Functions.ChangePasswordAsync(
            Post(new ChangePasswordRequest(Password, "a new password"), token), None);

        Assert.Equal(StatusCodes.Status400BadRequest, status);
        Assert.Equal("wrong-password", error.Code);
        Assert.Equal(StatusCodes.Status204NoContent, Status(done));
    }

    [Fact]
    public async Task SessionResolver_FindsTheHouseholdFromTheCookieAsync()
    {
        var token = await RegisterAsync();
        var household = _accounts.Users.Users.Values.Single().HouseholdId;
        var resolver = new SessionHouseholdResolver(_accounts.Service);

        Assert.Equal(household, await resolver.ResolveAsync(Get(token), None));
        Assert.Equal(household, await resolver.ResolveAsync(Post(cookie: token), None));
        Assert.Null(await resolver.ResolveAsync(Get(), None));
        Assert.Null(await resolver.ResolveAsync(Get("made-up"), None));
    }

    [Fact]
    public async Task SessionResolver_RefusesChangesFromOtherOriginsAsync()
    {
        var token = await RegisterAsync();
        var resolver = new SessionHouseholdResolver(_accounts.Service);
        var put = Post(cookie: token, origin: "https://evil.example");
        put.Method = "PUT";
        var get = Get(token);
        get.Headers.Origin = "https://evil.example";

        Assert.Null(await resolver.ResolveAsync(put, None));
        // Reading is not refused here; SameSite=Lax keeps the cookie off other sites' requests anyway.
        Assert.NotNull(await resolver.ResolveAsync(get, None));
    }

    [Fact]
    public async Task FirstHouseholdResolver_FallsBackInOrderAsync()
    {
        var request = Get();
        request.Headers[DevHeaderHouseholdResolver.HeaderName] = "dev";
        var token = await RegisterAsync();
        var household = _accounts.Users.Users.Values.Single().HouseholdId;
        var resolver = new FirstHouseholdResolver(
            new SessionHouseholdResolver(_accounts.Service), new DevHeaderHouseholdResolver());

        Assert.Equal("dev", await resolver.ResolveAsync(request, None));
        request.Headers.Cookie = $"{SessionCookie.Name}={token}";
        Assert.Equal(household, await resolver.ResolveAsync(request, None));
    }
}
