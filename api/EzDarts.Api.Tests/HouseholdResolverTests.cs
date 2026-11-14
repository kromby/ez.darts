using EzDarts.Api.Households;
using Microsoft.AspNetCore.Http;

namespace EzDarts.Api.Tests;

public class HouseholdResolverTests
{
    [Theory]
    [InlineData("household-1", "household-1")]
    [InlineData("", null)]
    [InlineData("a/b", null)]
    [InlineData("has space", null)]
    public async Task DevHeader_TrustsOnlyASafeIdAsync(string header, string? expected)
    {
        var request = new DefaultHttpContext().Request;
        request.Headers[DevHeaderHouseholdResolver.HeaderName] = header;

        Assert.Equal(expected, await new DevHeaderHouseholdResolver().ResolveAsync(request, CancellationToken.None));
    }

    [Fact]
    public async Task DevHeader_FindsNothingWithoutTheHeaderAsync()
    {
        Assert.Null(await new DevHeaderHouseholdResolver()
            .ResolveAsync(new DefaultHttpContext().Request, CancellationToken.None));
    }
}
