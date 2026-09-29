using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EscapeRoom.Api.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260929180000_AddMatchingIcons")]
public partial class AddMatchingIcons : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "MatchingIconKey",
            table: "ChallengeOptions",
            type: "character varying(40)",
            maxLength: 40,
            nullable: true);

        migrationBuilder.Sql(
            """
            UPDATE "ChallengeOptions" AS option
            SET "MatchingIconKey" = CASE
                WHEN LOWER(option."Text") LIKE '%järnväg%' THEN 'train'
                WHEN LOWER(option."Text") LIKE '%halt%' OR LOWER(option."Text") LIKE '%väglag%' THEN 'weather'
                WHEN LOWER(option."Text") LIKE '%skol%' THEN 'school'
                ELSE 'map-pin'
            END
            FROM "Challenges" AS challenge
            INNER JOIN "Games" AS game ON game."Id" = challenge."GameId"
            WHERE option."ChallengeId" = challenge."Id"
              AND game."Slug" = 'risk-och-sakerhet';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "MatchingIconKey", table: "ChallengeOptions");
    }
}
