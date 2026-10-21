using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EscapeRoom.Api.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261021113000_AddSessionPrivacyData")]
public partial class AddSessionPrivacyData : Migration
{
    private static readonly string[] ExperienceModeIndexColumns =
        ["ExperienceMode", "Status", "CompletedAtUtc"];
    private static readonly string[] LegacyIndexColumns = ["Status", "CompletedAtUtc"];

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_GameSessions_Status_CompletedAtUtc",
            table: "GameSessions");

        migrationBuilder.AddColumn<int>(
            name: "ExperienceMode",
            table: "GameSessions",
            type: "integer",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.CreateIndex(
            name: "IX_GameSessions_ExperienceMode_Status_CompletedAtUtc",
            table: "GameSessions",
            columns: ExperienceModeIndexColumns);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_GameSessions_ExperienceMode_Status_CompletedAtUtc",
            table: "GameSessions");

        migrationBuilder.DropColumn(
            name: "ExperienceMode",
            table: "GameSessions");

        migrationBuilder.CreateIndex(
            name: "IX_GameSessions_Status_CompletedAtUtc",
            table: "GameSessions",
            columns: LegacyIndexColumns);
    }
}
