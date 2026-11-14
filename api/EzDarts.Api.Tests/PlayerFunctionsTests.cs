using EzDarts.Api.Http;
using EzDarts.Api.Players;
using Microsoft.AspNetCore.Http;
using NSubstitute;
using static EzDarts.Api.Tests.TestRequests;

namespace EzDarts.Api.Tests;

public class PlayerFunctionsTests
{
    private readonly IPlayerStore _store = Substitute.For<IPlayerStore>();

    private PlayerFunctions Functions(bool signedIn = true) => new(Resolver(signedIn), _store);

    private void Existing(params PlayerDto[] players) =>
        _store.ListAsync(Household, Arg.Any<CancellationToken>()).Returns(players);

    [Fact]
    public async Task List_NeedsAHouseholdAsync()
    {
        var result = await Functions(signedIn: false).ListAsync(Empty(), CancellationToken.None);

        Assert.Equal(StatusCodes.Status401Unauthorized, Status(result));
        await _store.DidNotReceiveWithAnyArgs().ListAsync(default!, default);
    }

    [Fact]
    public async Task List_ReturnsTheHouseholdsPlayersByNameAsync()
    {
        Existing(new PlayerDto("2", "Óli"), new PlayerDto("1", "anna", "sky"), new PlayerDto("3", "Bjarni"));

        var (status, body) = Json<List<PlayerDto>>(await Functions().ListAsync(Empty(), CancellationToken.None));

        Assert.Equal(StatusCodes.Status200OK, status);
        Assert.Equal(["anna", "Bjarni", "Óli"], body.Select(p => p.Name));
    }

    [Fact]
    public async Task Put_NeedsAHouseholdAsync()
    {
        var result = await Functions(signedIn: false)
.PutAsync(WithJson(new PlayerDto("anna", "Anna")), "anna", CancellationToken.None);

        Assert.Equal(StatusCodes.Status401Unauthorized, Status(result));
        await _store.DidNotReceiveWithAnyArgs().UpsertAsync(default!, default!, default);
    }

    [Fact]
    public async Task Put_CreatesAPlayerWithATidyNameAsync()
    {
        Existing();
        _store.UpsertAsync(Household, Arg.Any<PlayerDto>(), Arg.Any<CancellationToken>()).Returns(true);

        var result = await Functions().PutAsync(
            WithJson(new PlayerDto("anna", "  Anna   Jóns ", "red")), "anna", CancellationToken.None);

        var (status, body) = Json<PlayerDto>(result);
        Assert.Equal(StatusCodes.Status201Created, status);
        Assert.Equal(new PlayerDto("anna", "Anna Jóns", "red"), body);
        await _store.Received(1).UpsertAsync(Household, body, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Put_UpdatesAndArchivesAsync()
    {
        Existing(new PlayerDto("anna", "Anna"));
        _store.UpsertAsync(Household, Arg.Any<PlayerDto>(), Arg.Any<CancellationToken>()).Returns(false);
        var archived = new PlayerDto("anna", "Anna", "sky", "2026-11-14T20:00:00.000Z");

        var result = await Functions().PutAsync(WithJson(archived), "anna", CancellationToken.None);

        Assert.Equal(StatusCodes.Status200OK, Status(result));
        await _store.Received(1).UpsertAsync(Household, archived, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("óli")]
    [InlineData(" ÓLI ")]
    [InlineData("gunna")]
    public async Task Put_KeepsNamesUnique_RemovedPlayersIncludedAsync(string name)
    {
        Existing(new PlayerDto("oli", "Óli"), new PlayerDto("gunna", "Gunna", ArchivedAt: "2026-11-01T20:00:00Z"));

        var result = await Functions().PutAsync(WithJson(new PlayerDto("new", name)), "new", CancellationToken.None);

        Assert.Equal(StatusCodes.Status409Conflict, Status(result));
        await _store.DidNotReceiveWithAnyArgs().UpsertAsync(default!, default!, default);
    }

    [Fact]
    public async Task Put_LetsAPlayerKeepTheirOwnNameAsync()
    {
        Existing(new PlayerDto("oli", "Óli"));

        var result = await Functions().PutAsync(
            WithJson(new PlayerDto("oli", "óli", "teal")), "oli", CancellationToken.None);

        Assert.NotEqual(StatusCodes.Status409Conflict, Status(result));
    }

    public static TheoryData<string, string> BadPlayers() => new()
    {
        // Body, URL id.
        { """{"id":"anna","name":"Anna"}""", "oli" },
        { """{"id":"a/b","name":"Anna"}""", "a/b" },
        { """{"id":"anna","name":"   "}""", "anna" },
        { $$"""{"id":"anna","name":"{{new string('a', PlayerFunctions.MaxNameLength + 1)}}"}""", "anna" },
        { """{"id":"anna","name":"Anna","color":"tartan"}""", "anna" },
        { """{"id":"anna","name":"Anna","archivedAt":"yesterday"}""", "anna" },
        { "not json", "anna" },
    };

    [Theory]
    [MemberData(nameof(BadPlayers))]
    public async Task Put_RejectsBadPlayersAsync(string body, string id)
    {
        Existing();

        var result = await Functions().PutAsync(WithText(body), id, CancellationToken.None);

        var (status, error) = Json<ErrorResponse>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, status);
        Assert.NotEmpty(error.Error);
        await _store.DidNotReceiveWithAnyArgs().UpsertAsync(default!, default!, default);
    }
}
