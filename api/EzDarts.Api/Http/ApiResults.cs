using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EzDarts.Api.Http;

/// <summary>JSON in and out, shaped like the web app's own types (camelCase, no nulls written).</summary>
public static partial class ApiJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>Reads the body, or <c>null</c> when it is missing or not valid JSON for <typeparamref name="T"/>.</summary>
    public static async Task<T?> ReadAsync<T>(HttpRequest request, CancellationToken cancellationToken)
        where T : class
    {
        try
        {
            return await JsonSerializer.DeserializeAsync<T>(request.Body, Options, cancellationToken);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>Player and game ids: the web app's UUIDs, or anything as safe as a table key.</summary>
    public static bool IsId(string? value) => value is not null && Id().IsMatch(value);

    [GeneratedRegex("^[A-Za-z0-9-]{1,64}$")]
    private static partial Regex Id();
}

public record ErrorResponse(string Error);

public static class ApiResults
{
    public static IActionResult Json(object value, int statusCode = StatusCodes.Status200OK) =>
        new JsonResult(value, ApiJson.Options) { StatusCode = statusCode };

    public static IActionResult Unauthorized() =>
        Json(new ErrorResponse("A signed-in household is needed."), StatusCodes.Status401Unauthorized);

    public static IActionResult BadRequest(string error) =>
        Json(new ErrorResponse(error), StatusCodes.Status400BadRequest);

    public static IActionResult NotFound() =>
        Json(new ErrorResponse("Not found."), StatusCodes.Status404NotFound);

    public static IActionResult Conflict(string error) =>
        Json(new ErrorResponse(error), StatusCodes.Status409Conflict);
}
