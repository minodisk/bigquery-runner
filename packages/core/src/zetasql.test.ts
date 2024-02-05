import { ZetaSQLClient, runServer } from "@fivetrandevelopers/zetasql";

describe("zetasql", () => {
  it("should be useful", async () => {
    const query = `
SELECT
    corpus,
    word,
    word_count
FROM
    \`bigquery-public-data.samples.shakespeare\`
WHERE
    corpus = @corpus -- "romeoandjuliet"
    AND word_count >= @min_word_count -- 250
ORDER BY
    word_count DESC
`;

    runServer(8080);
    console.log("run server");

    ZetaSQLClient.init(8080);
    const cli = ZetaSQLClient.getInstance();
    const connected = await cli.testConnection();
    console.log("connected:", connected);

    const res = await cli.analyze({
      sqlStatement: query,
    });
    console.log(res);
  });
});
