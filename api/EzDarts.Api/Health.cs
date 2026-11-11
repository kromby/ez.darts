using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace EzDarts.Api;

public class Health
{
    [Function("Health")]
    public IActionResult Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")] HttpRequest req)
    {
        return new OkObjectResult(new HealthResponse("ok"));
    }
}

public record HealthResponse(string Status);
