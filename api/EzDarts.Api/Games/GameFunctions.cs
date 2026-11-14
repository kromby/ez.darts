using EzDarts.Api.Households;
using EzDarts.Api.Http;
using EzDarts.Api.Stats;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace EzDarts.Api.Games;

/// <summary>
/// Save, list, get and delete the signed-in household's games. Saving keeps <c>PlayerStats</c> in
/// step: a game counts once it is finished with a summary, and a change or delete adjusts it.
/// </summary>
public class GameFunctions(IHouseholdResolver households, IGameStore games, IStatsStore stats)
{
    [Function("ListGames")]
    public async Task<IActionResult> ListAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "games")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        var household = await households.ResolveAsync(req, cancellationToken);
        return household is null
            ? ApiResults.Unauthorized()
            : ApiResults.Json(await games.ListAsync(household, cancellationToken));
    }

    [Function("GetGame")]
    public async Task<IActionResult> GetAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "games/{id}")] HttpRequest req,
        string id,
        CancellationToken cancellationToken)
    {
        var household = await households.ResolveAsync(req, cancellationToken);
        if (household is null)
        {
            return ApiResults.Unauthorized();
        }

        var stored = ApiJson.IsId(id) ? await games.GetAsync(household, id, cancellationToken) : null;
        return stored is null ? ApiResults.NotFound() : ApiResults.Json(stored.Game);
    }

    /// <summary>
    /// Creates or replaces a game by its id, after every dart if the app likes: the same request twice
    /// stores the same game and counts its stats once.
    /// </summary>
    [Function("PutGame")]
    public async Task<IActionResult> PutAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "games/{id}")] HttpRequest req,
        string id,
        CancellationToken cancellationToken)
    {
        var household = await households.ResolveAsync(req, cancellationToken);
        if (household is null)
        {
            return ApiResults.Unauthorized();
        }

        var game = await ApiJson.ReadAsync<GameDto>(req, cancellationToken);
        if (game is null || game.Id != id)
        {
            return ApiResults.BadRequest("Send the game as JSON, with the id from the URL.");
        }

        var error = GameValidator.Validate(game);
        if (error is not null)
        {
            return ApiResults.BadRequest(error);
        }

        var existing = await games.GetAsync(household, id, cancellationToken);
        var applied = existing?.StatsApplied;
        var next = StatsSource.From(game);

        // The game is saved still marked with the stats it had, then the stats change, then the mark
        // moves. A retry after a failure in between finds the old mark and makes the same change once.
        await games.SaveAsync(household, game, applied, cancellationToken);
        var delta = StatsContribution.Delta(applied, next);
        if (delta.Count > 0)
        {
            await stats.ApplyAsync(household, delta, cancellationToken);
            await games.SetStatsAppliedAsync(household, id, next, cancellationToken);
        }

        return ApiResults.Json(game, existing is null ? StatusCodes.Status201Created : StatusCodes.Status200OK);
    }

    /// <summary>For a game quit before the end; a finished one's stats are taken back out.</summary>
    [Function("DeleteGame")]
    public async Task<IActionResult> DeleteAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "games/{id}")] HttpRequest req,
        string id,
        CancellationToken cancellationToken)
    {
        var household = await households.ResolveAsync(req, cancellationToken);
        if (household is null)
        {
            return ApiResults.Unauthorized();
        }

        var existing = ApiJson.IsId(id) ? await games.GetAsync(household, id, cancellationToken) : null;
        if (existing is null)
        {
            return ApiResults.NotFound();
        }

        var delta = StatsContribution.Delta(existing.StatsApplied, null);
        if (delta.Count > 0)
        {
            await stats.ApplyAsync(household, delta, cancellationToken);
            await games.SetStatsAppliedAsync(household, id, null, cancellationToken);
        }

        await games.DeleteAsync(household, id, cancellationToken);
        return new NoContentResult();
    }
}
