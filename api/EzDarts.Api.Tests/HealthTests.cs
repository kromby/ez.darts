using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EzDarts.Api.Tests;

public class HealthTests
{
    [Fact]
    public void Run_ReturnsOkStatus()
    {
        var result = new Health().Run(new DefaultHttpContext().Request);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(new HealthResponse("ok"), ok.Value);
    }
}
