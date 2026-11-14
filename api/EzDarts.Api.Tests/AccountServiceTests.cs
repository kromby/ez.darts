using EzDarts.Api.Accounts;
using Microsoft.AspNetCore.Identity;

namespace EzDarts.Api.Tests;

public class AccountServiceTests
{
    private const string Email = "Anna@Example.com ";
    private const string Password = "correct horse battery";
    private readonly TestAccounts _accounts = new();
    private AccountService Service => _accounts.Service;
    private static readonly CancellationToken None = CancellationToken.None;

    private async Task<AccountResult> RegisterAsync() => await Service.RegisterAsync(Email, Password, None);

    [Fact]
    public async Task Register_CreatesAnAccountWithItsOwnHouseholdAndASessionAsync()
    {
        var result = await RegisterAsync();

        Assert.True(result.Succeeded);
        var user = Assert.Single(_accounts.Users.Users.Values);
        Assert.Equal("anna@example.com", user.Email);
        Assert.Equal(Tokens.EmailKey("anna@example.com"), user.EmailKey);
        Assert.Matches("^[0-9a-f]{32}$", user.HouseholdId);
        Assert.Equal(result.User, user);
        Assert.NotNull(await Service.FindSessionAsync(result.Token, None));
    }

    [Fact]
    public async Task Register_HashesThePasswordWithIdentitysHasherAsync()
    {
        await RegisterAsync();

        var user = _accounts.Users.Users.Values.Single();
        Assert.DoesNotContain(Password, user.PasswordHash);
        Assert.Equal(
            PasswordVerificationResult.Success,
            new PasswordHasher<UserRecord>().VerifyHashedPassword(user, user.PasswordHash, Password));
        // Identity v3 format: PBKDF2, a version byte of 0x01.
        Assert.Equal(1, Convert.FromBase64String(user.PasswordHash)[0]);
    }

    [Fact]
    public async Task Register_RefusesATakenEmailInAnyCaseAsync()
    {
        await RegisterAsync();

        var again = await Service.RegisterAsync("ANNA@example.com", "another password", None);

        Assert.Equal(AccountError.EmailTaken, again.Error);
        Assert.Single(_accounts.Users.Users);
    }

    [Theory]
    [InlineData("not-an-email", Password, AccountError.InvalidEmail)]
    [InlineData("", Password, AccountError.InvalidEmail)]
    [InlineData(null, Password, AccountError.InvalidEmail)]
    [InlineData("anna@example.com", "short", AccountError.WeakPassword)]
    [InlineData("anna@example.com", "        ", AccountError.WeakPassword)]
    [InlineData("anna@example.com", null, AccountError.WeakPassword)]
    public async Task Register_ChecksEmailAndPasswordAsync(string? email, string? password, AccountError error)
    {
        Assert.Equal(error, (await Service.RegisterAsync(email, password, None)).Error);
        Assert.Empty(_accounts.Users.Users);
    }

    [Fact]
    public async Task Register_RefusesAPasswordTooLongToHashCheaplyAsync()
    {
        var result = await Service.RegisterAsync(
            "anna@example.com", new string('x', AccountService.MaxPasswordLength + 1), None);

        Assert.Equal(AccountError.WeakPassword, result.Error);
    }

    [Fact]
    public async Task Login_StartsANewSessionAsync()
    {
        var registered = await RegisterAsync();

        var result = await Service.LoginAsync("anna@example.com", Password, None);

        Assert.True(result.Succeeded);
        Assert.NotEqual(registered.Token, result.Token);
        Assert.Equal(registered.User!.HouseholdId, result.User!.HouseholdId);
        Assert.Equal(_accounts.Clock.Now, _accounts.Users.Users.Values.Single().LastLoginAt);
    }

    [Fact]
    public async Task Login_GivesTheSameErrorForAnUnknownEmailAndAWrongPasswordAsync()
    {
        await RegisterAsync();

        var wrongPassword = await Service.LoginAsync("anna@example.com", "wrong password", None);
        var unknownEmail = await Service.LoginAsync("nobody@example.com", Password, None);

        Assert.Equal(AccountError.InvalidCredentials, wrongPassword.Error);
        Assert.Equal(wrongPassword, unknownEmail);
        Assert.Equal(
            AccountFunctions.Failed(wrongPassword.Error).ToString(),
            AccountFunctions.Failed(unknownEmail.Error).ToString());
    }

    [Fact]
    public async Task Login_LocksAnEmailOutAfterRepeatedFailuresAsync()
    {
        await RegisterAsync();
        for (var i = 0; i < AccountService.MaxFailures; i++)
        {
            Assert.Equal(AccountError.InvalidCredentials,
                (await Service.LoginAsync("anna@example.com", "wrong password", None)).Error);
        }

        // Even the right password is refused while locked out.
        Assert.Equal(AccountError.LockedOut, (await Service.LoginAsync("anna@example.com", Password, None)).Error);

        _accounts.Clock.Advance(AccountService.LockoutTime);
        Assert.True((await Service.LoginAsync("anna@example.com", Password, None)).Succeeded);
    }

    [Fact]
    public async Task Login_LocksOutAnUnknownEmailToo_SoALockoutRevealsNothingAsync()
    {
        for (var i = 0; i < AccountService.MaxFailures; i++)
        {
            await Service.LoginAsync("nobody@example.com", "guess", None);
        }

        Assert.Equal(AccountError.LockedOut, (await Service.LoginAsync("nobody@example.com", "guess", None)).Error);
    }

    [Fact]
    public async Task Login_ForgetsOldFailuresAndResetsAfterSuccessAsync()
    {
        await RegisterAsync();
        for (var i = 0; i < AccountService.MaxFailures - 1; i++)
        {
            await Service.LoginAsync("anna@example.com", "wrong password", None);
        }

        _accounts.Clock.Advance(AccountService.FailureWindow);
        await Service.LoginAsync("anna@example.com", "wrong password", None);
        Assert.Equal(1, _accounts.Attempts.Attempts.Values.Single().Failures);

        Assert.True((await Service.LoginAsync("anna@example.com", Password, None)).Succeeded);
        Assert.Empty(_accounts.Attempts.Attempts);
    }

    [Fact]
    public async Task Login_UpgradesAnOldHashAsync()
    {
        await RegisterAsync();
        var user = _accounts.Users.Users.Values.Single();
        var v2 = new PasswordHasher<UserRecord>(Microsoft.Extensions.Options.Options.Create(
            new PasswordHasherOptions { CompatibilityMode = PasswordHasherCompatibilityMode.IdentityV2 }));
        _accounts.Users.Users[user.EmailKey] = user with { PasswordHash = v2.HashPassword(user, Password) };

        Assert.True((await Service.LoginAsync("anna@example.com", Password, None)).Succeeded);

        Assert.Equal(1, Convert.FromBase64String(_accounts.Users.Users[user.EmailKey].PasswordHash)[0]);
    }

    [Fact]
    public async Task Sessions_StoreOnlyTheTokensSha256Async()
    {
        var result = await RegisterAsync();

        var stored = Assert.Single(_accounts.Sessions.Sessions.Values);
        Assert.Equal(Tokens.Hash(result.Token!), stored.TokenHash);
        Assert.DoesNotContain(_accounts.Sessions.Sessions.Values, s => s.TokenHash == result.Token);
        Assert.Matches("^[0-9a-f]{64}$", stored.TokenHash);
    }

    [Fact]
    public async Task Sessions_ExpireAndAreRenewedWhenUsedAsync()
    {
        var token = (await RegisterAsync()).Token;

        _accounts.Clock.Advance(AccountService.SessionLifetime - AccountService.RenewWhenLeft + TimeSpan.FromDays(1));
        var renewed = await Service.FindSessionAsync(token, None);
        Assert.Equal(_accounts.Clock.Now + AccountService.SessionLifetime, renewed!.ExpiresAt);

        _accounts.Clock.Advance(AccountService.SessionLifetime);
        Assert.Null(await Service.FindSessionAsync(token, None));
        Assert.Empty(_accounts.Sessions.Sessions);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("made-up-token")]
    public async Task Sessions_UnknownTokensFindNothingAsync(string? token)
    {
        await RegisterAsync();

        Assert.Null(await Service.FindSessionAsync(token, None));
    }

    [Fact]
    public async Task Logout_EndsOnlyThisSessionAsync()
    {
        var first = (await RegisterAsync()).Token;
        var second = (await Service.LoginAsync(Email, Password, None)).Token;

        await Service.LogoutAsync(first, None);

        Assert.Null(await Service.FindSessionAsync(first, None));
        Assert.NotNull(await Service.FindSessionAsync(second, None));
    }

    [Fact]
    public async Task LogoutEverywhere_EndsEverySessionOfTheAccountAsync()
    {
        var first = (await RegisterAsync()).Token;
        var second = (await Service.LoginAsync(Email, Password, None)).Token;
        var other = (await Service.RegisterAsync("oli@example.com", Password, None)).Token;

        Assert.True(await Service.LogoutEverywhereAsync(first, None));

        Assert.Null(await Service.FindSessionAsync(first, None));
        Assert.Null(await Service.FindSessionAsync(second, None));
        Assert.NotNull(await Service.FindSessionAsync(other, None));
        Assert.False(await Service.LogoutEverywhereAsync(first, None));
    }

    [Fact]
    public async Task ChangePassword_NeedsTheCurrentOneAndSignsOutOtherDevicesAsync()
    {
        var here = (await RegisterAsync()).Token;
        var elsewhere = (await Service.LoginAsync(Email, Password, None)).Token;

        Assert.Equal(AccountError.WrongPassword,
            (await Service.ChangePasswordAsync(here, "wrong password", "a new password", None)).Error);
        Assert.Equal(AccountError.WeakPassword,
            (await Service.ChangePasswordAsync(here, Password, "short", None)).Error);
        Assert.Equal(AccountError.NoSession,
            (await Service.ChangePasswordAsync("made-up", Password, "a new password", None)).Error);

        Assert.True((await Service.ChangePasswordAsync(here, Password, "a new password", None)).Succeeded);

        Assert.NotNull(await Service.FindSessionAsync(here, None));
        Assert.Null(await Service.FindSessionAsync(elsewhere, None));
        Assert.False((await Service.LoginAsync(Email, Password, None)).Succeeded);
        Assert.True((await Service.LoginAsync(Email, "a new password", None)).Succeeded);
    }
}
