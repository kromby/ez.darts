using System.Globalization;
using System.Text.RegularExpressions;
using EzDarts.Api.Households;
using EzDarts.Api.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace EzDarts.Api.Players;

/// <summary>List, create and update the signed-in household's players.</summary>
public partial class PlayerFunctions(IHouseholdResolver households, IPlayerStore players)
{
    public const int MaxNameLength = 40;

    private static readonly string[] Colors =
        ["sky", "pink", "lime", "amber", "violet", "teal", "red", "orange"];

    [Function("ListPlayers")]
    public async Task<IActionResult> ListAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "players")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        var household = await households.ResolveAsync(req, cancellationToken);
        if (household is null)
        {
            return ApiResults.Unauthorized();
        }

        var list = await players.ListAsync(household, cancellationToken);
        // The web app sorts in Icelandic order itself; this is only a stable default.
        return ApiResults.Json(list.OrderBy(p => p.Name, StringComparer.InvariantCultureIgnoreCase).ToList());
    }

    /// <summary>Creates or replaces a player; ids come from the web app, so retries are safe.</summary>
    [Function("PutPlayer")]
    public async Task<IActionResult> PutAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "players/{id}")] HttpRequest req,
        string id,
        CancellationToken cancellationToken)
    {
        var household = await households.ResolveAsync(req, cancellationToken);
        if (household is null)
        {
            return ApiResults.Unauthorized();
        }

        var body = await ApiJson.ReadAsync<PlayerDto>(req, cancellationToken);
        if (body is null || body.Id != id || !ApiJson.IsId(id))
        {
            return ApiResults.BadRequest("Send the player as JSON, with the id from the URL.");
        }

        var error = Validate(body);
        if (error is not null)
        {
            return ApiResults.BadRequest(error);
        }

        var player = body with { Name = NormalizeName(body.Name) };
        var existing = await players.ListAsync(household, cancellationToken);
        // Names stay unique, removed players included, so history never shows two players as one.
        if (existing.Any(p => p.Id != id && SameName(p.Name, player.Name)))
        {
            return ApiResults.Conflict("Another player already has this name.");
        }

        var created = await players.UpsertAsync(household, player, cancellationToken);
        return ApiResults.Json(player, created ? StatusCodes.Status201Created : StatusCodes.Status200OK);
    }

    private static string? Validate(PlayerDto player)
    {
        var name = NormalizeName(player.Name);
        if (name.Length == 0 || name.Length > MaxNameLength)
        {
            return $"A name needs 1 to {MaxNameLength} characters.";
        }

        if (player.Color is not null && !Colors.Contains(player.Color))
        {
            return "Unknown colour.";
        }

        if (player.ArchivedAt is not null && !DateTimeOffset.TryParse(
                player.ArchivedAt, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out _))
        {
            return "archivedAt must be an ISO 8601 time.";
        }

        return null;
    }

    /// <summary>As the web app: trimmed, with runs of spaces made one.</summary>
    public static string NormalizeName(string? name) => Spaces().Replace((name ?? "").Trim(), " ");

    // Ordinal, so it works without culture data too; Á/á and Ö/ö still match.
    private static bool SameName(string a, string b) =>
        string.Equals(NormalizeName(a), NormalizeName(b), StringComparison.OrdinalIgnoreCase);

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();
}
