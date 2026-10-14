using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EscapeRoom.Api.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261014120000_AddChallengeAvailability")]
public partial class AddChallengeAvailability : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "IsEnabled",
            table: "Challenges",
            type: "boolean",
            nullable: false,
            defaultValue: true);

        migrationBuilder.Sql(
            """
            UPDATE "Games"
            SET "Title" = 'Uppdraget'
            WHERE "Slug" = 'trafikverket-uppdraget';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE "Games"
            SET "Title" = 'Trafikverket – Uppdraget'
            WHERE "Slug" = 'trafikverket-uppdraget';
            """);

        migrationBuilder.DropColumn(name: "IsEnabled", table: "Challenges");
    }
}
