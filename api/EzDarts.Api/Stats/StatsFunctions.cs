using EzDarts.Api.Households;
using EzDarts.Api.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace EzDarts.Api.Stats;

public class StatsFunctions(IHouseholdResolver households, IStatsStore stats)
{
    /// <summary>
    /// Every stats row of the household: per player, game type and ISO week. The app adds rows up for
    /// whatever period and game it shows.
    /// </summary>
    [Function("GetStats")]
    public async Task<IActionResult> Get(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "stats")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        var household = await households.ResolveAsync(req, cancellationToken);
        return household is null
            ? ApiResults.Unauthorized()
            : ApiResults.Json(await stats.ListAsync(household, cancellationToken));
    }
}
