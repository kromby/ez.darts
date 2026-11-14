using System.Text;
using System.Text.Json;
using EzDarts.Api.Games;
using EzDarts.Api.Households;
using EzDarts.Api.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using NSubstitute;

namespace EzDarts.Api.Tests;

internal static class TestRequests
{
    public const string Household = "household-1";

    public static HttpRequest Empty() => new DefaultHttpContext().Request;

    public static HttpRequest WithJson(object body) => WithText(JsonSerializer.Serialize(body, ApiJson.Options));

    public static HttpRequest WithText(string body)
    {
        var context = new DefaultHttpContext();
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
        context.Request.ContentType = "application/json";
        return context.Request;
    }

    /// <summary>A resolver that finds <see cref="Household"/>, or nobody.</summary>
    public static IHouseholdResolver Resolver(bool signedIn = true)
    {
        var resolver = Substitute.For<IHouseholdResolver>();
        resolver.ResolveAsync(Arg.Any<HttpRequest>(), Arg.Any<CancellationToken>())
            .Returns(signedIn ? Household : null);
        return resolver;
    }

    public static (int Status, T Body) Json<T>(IActionResult result)
    {
        var json = Assert.IsType<JsonResult>(result);
        return (json.StatusCode ?? StatusCodes.Status200OK, Assert.IsAssignableFrom<T>(json.Value));
    }

    public static int Status(IActionResult result) => result switch
    {
        JsonResult json => json.StatusCode ?? StatusCodes.Status200OK,
        IStatusCodeActionResult status => status.StatusCode ?? StatusCodes.Status200OK,
        _ => throw new InvalidOperationException($"No status on {result.GetType()}"),
    };

    public static readonly JsonElement NoOptions = JsonDocument.Parse("""{"startScore":501}""").RootElement;

    /// <summary>Anna and Óli, Anna threw T20 and missed; finished with a summary when asked.</summary>
    public static GameDto Game(string id = "game-1", bool finished = false, string finishedAt = "2026-11-14T21:00:00.000Z")
    {
        IReadOnlyList<SlotDto> slots = [new("anna"), new("oli")];
        return new GameDto(
            id,
            "x01",
            1,
            NoOptions,
            slots,
            [new ThrownDartDto("anna", new DartDto(20, 3)), new ThrownDartDto("anna", new DartDto(0, 0))],
            "2026-11-14T20:00:00.000Z",
            finished ? new GameResultDto(["anna", "oli"], finishedAt) : null,
            finished
                ?
                [
                    new PlayerSummaryDto("anna", 2, 0, 0, 1, 1, 1, 60),
                    new PlayerSummaryDto("oli", 0, 0, 0, 0, 0, 2, 0),
                ]
                : null);
    }
}
