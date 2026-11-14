using EzDarts.Api.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace EzDarts.Api.Accounts;

/// <summary>
/// Sign-up, sign-in, sign-out and password change under <c>/api/account</c>, kept clear of Static
/// Web Apps' own <c>/.auth</c> routes. Every call that changes something must come from this site's
/// own pages (<see cref="OriginCheck"/>).
/// </summary>
public class AccountFunctions(AccountService accounts)
{
    [Function("Register")]
    public async Task<IActionResult> RegisterAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "account/register")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        if (!OriginCheck.IsSameOrigin(req))
        {
            return Forbidden();
        }

        var body = await ApiJson.ReadAsync<CredentialsRequest>(req, cancellationToken);
        var result = await accounts.RegisterAsync(body?.Email, body?.Password, cancellationToken);
        return Signed(req, result, StatusCodes.Status201Created);
    }

    [Function("Login")]
    public async Task<IActionResult> LoginAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "account/login")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        if (!OriginCheck.IsSameOrigin(req))
        {
            return Forbidden();
        }

        var body = await ApiJson.ReadAsync<CredentialsRequest>(req, cancellationToken);
        var result = await accounts.LoginAsync(body?.Email, body?.Password, cancellationToken);
        return Signed(req, result, StatusCodes.Status200OK);
    }

    /// <summary>Who is signed in on this device, or 401.</summary>
    [Function("Me")]
    public async Task<IActionResult> MeAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "account/me")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        var user = await accounts.FindUserAsync(SessionCookie.Read(req), cancellationToken);
        return user is null
            ? ApiResults.Unauthorized()
            : ApiResults.Json(new AccountResponse(user.Email, user.HouseholdId));
    }

    [Function("Logout")]
    public async Task<IActionResult> LogoutAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "account/logout")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        if (!OriginCheck.IsSameOrigin(req))
        {
            return Forbidden();
        }

        await accounts.LogoutAsync(SessionCookie.Read(req), cancellationToken);
        SessionCookie.Clear(req.HttpContext.Response);
        return new NoContentResult();
    }

    /// <summary>Signs the account out on every device, this one included.</summary>
    [Function("LogoutEverywhere")]
    public async Task<IActionResult> LogoutEverywhereAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "account/logout-everywhere")]
        HttpRequest req,
        CancellationToken cancellationToken)
    {
        if (!OriginCheck.IsSameOrigin(req))
        {
            return Forbidden();
        }

        var signedIn = await accounts.LogoutEverywhereAsync(SessionCookie.Read(req), cancellationToken);
        SessionCookie.Clear(req.HttpContext.Response);
        return signedIn ? new NoContentResult() : ApiResults.Unauthorized();
    }

    /// <summary>Changes the password; every other device is signed out.</summary>
    [Function("ChangePassword")]
    public async Task<IActionResult> ChangePasswordAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "account/password")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        if (!OriginCheck.IsSameOrigin(req))
        {
            return Forbidden();
        }

        var body = await ApiJson.ReadAsync<ChangePasswordRequest>(req, cancellationToken);
        var result = await accounts.ChangePasswordAsync(
            SessionCookie.Read(req), body?.CurrentPassword, body?.NewPassword, cancellationToken);
        return result.Succeeded ? new NoContentResult() : Failed(result.Error);
    }

    /// <summary>On success, the session cookie and who is signed in; otherwise the error.</summary>
    private static IActionResult Signed(HttpRequest req, AccountResult result, int status)
    {
        if (!result.Succeeded || result.User is null || result.Token is null)
        {
            return Failed(result.Error);
        }

        SessionCookie.Write(req.HttpContext.Response, result.Token, AccountService.SessionLifetime);
        return ApiResults.Json(new AccountResponse(result.User.Email, result.User.HouseholdId), status);
    }

    public static IActionResult Failed(AccountError error) => error switch
    {
        AccountError.InvalidEmail => Error(StatusCodes.Status400BadRequest, "invalid-email", "Enter a valid email."),
        AccountError.WeakPassword => Error(StatusCodes.Status400BadRequest, "weak-password",
            $"A password needs {AccountService.MinPasswordLength} to {AccountService.MaxPasswordLength} characters."),
        AccountError.EmailTaken => Error(StatusCodes.Status409Conflict, "email-taken",
            "This email already has an account."),
        // One answer for an unknown email and a wrong password, so neither gives the other away.
        AccountError.InvalidCredentials => Error(StatusCodes.Status401Unauthorized, "invalid-credentials",
            "Wrong email or password."),
        AccountError.LockedOut => Error(StatusCodes.Status429TooManyRequests, "locked-out",
            "Too many attempts. Try again later."),
        AccountError.WrongPassword => Error(StatusCodes.Status400BadRequest, "wrong-password",
            "The current password is wrong."),
        _ => ApiResults.Unauthorized(),
    };

    private static IActionResult Error(int status, string code, string message) =>
        ApiResults.Json(new ErrorResponse(message, code), status);

    private static IActionResult Forbidden() =>
        Error(StatusCodes.Status403Forbidden, "wrong-origin", "Send this from the app itself.");
}
