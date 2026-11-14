using EzDarts.Api.Accounts;
using Microsoft.AspNetCore.Http;

namespace EzDarts.Api.Tests;

public class OriginAndTokenTests
{
    private static HttpRequest Request(string? origin, string host = "darts.example", string? forwarded = null)
    {
        var request = new DefaultHttpContext().Request;
        request.Method = "POST";
        request.Host = new HostString(host);
        if (origin is not null)
        {
            request.Headers.Origin = origin;
        }

        if (forwarded is not null)
        {
            request.Headers["X-Forwarded-Host"] = forwarded;
        }

        return request;
    }

    [Theory]
    [InlineData(null, "darts.example", null, true)]
    [InlineData("https://darts.example", "darts.example", null, true)]
    [InlineData("http://localhost:5173", "localhost:5173", null, true)]
    [InlineData("https://darts.example", "internal.azurewebsites.net", "darts.example", true)]
    [InlineData("https://evil.example", "darts.example", null, false)]
    [InlineData("https://evil.example", "internal.azurewebsites.net", "darts.example", false)]
    [InlineData("http://localhost:4280", "localhost:5173", null, false)]
    [InlineData("null", "darts.example", null, false)]
    public void OriginCheck_AcceptsOnlyThisSite(string? origin, string host, string? forwarded, bool allowed)
    {
        Assert.Equal(allowed, OriginCheck.IsSameOrigin(Request(origin, host, forwarded)));
    }

    [Theory]
    [InlineData("same-origin", true)]
    [InlineData("none", true)]
    [InlineData("same-site", false)]
    [InlineData("cross-site", false)]
    public void OriginCheck_TrustsSecFetchSiteFirst(string site, bool allowed)
    {
        // Behind a proxy the host differs from the Origin, so only Sec-Fetch-Site can tell.
        var request = Request("http://localhost:5173", "localhost:7071");
        request.Headers["Sec-Fetch-Site"] = site;

        Assert.Equal(allowed, OriginCheck.IsSameOrigin(request));
    }

    [Fact]
    public void Tokens_AreRandom32BytesAndHashedWithSha256()
    {
        var a = Tokens.NewSessionToken();
        var b = Tokens.NewSessionToken();

        Assert.NotEqual(a, b);
        Assert.Matches("^[A-Za-z0-9_-]{43}$", a);
        Assert.Equal(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", Tokens.Hash(""));
        Assert.Equal(Tokens.EmailKey("Anna@Example.com "), Tokens.EmailKey("anna@example.com"));
    }
}
