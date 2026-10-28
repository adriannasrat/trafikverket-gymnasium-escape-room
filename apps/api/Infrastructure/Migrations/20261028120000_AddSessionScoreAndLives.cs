using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EscapeRoom.Api.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261028120000_AddSessionScoreAndLives")]
public partial class AddSessionScoreAndLives : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "LivesRemaining",
            table: "GameSessions",
            type: "integer",
            nullable: false,
            defaultValue: 5);

        migrationBuilder.AddColumn<int>(
            name: "Score",
            table: "GameSessions",
            type: "integer",
            nullable: false,
            defaultValue: 0);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "LivesRemaining", table: "GameSessions");
        migrationBuilder.DropColumn(name: "Score", table: "GameSessions");
    }
}
