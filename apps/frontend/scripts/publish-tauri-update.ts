import { Octokit } from "@octokit/rest";
import { config } from "dotenv";
import {
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from "@aws-sdk/client-s3";
config();

const errors: string[] = [];

const [
    GITHUB_TOKEN,
    GIST_TOKEN,
    GIST_ID,
    REPOSITORY_NAME,
    REPOSITORY_OWNER,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_ENDPOINT,
    S3_PUBLIC_URL,
] = (
    [
        "GITHUB_TOKEN",
        "GIST_TOKEN",
        "GIST_ID",
        "REPOSITORY_NAME",
        "REPOSITORY_OWNER",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
        "S3_ENDPOINT",
        "S3_PUBLIC_URL",
    ] as const
).map((v) => {
    const value = process.env[v];
    if (!value) {
        errors.push(`${v} is not set`);
    }
    return value ?? "";
});

const S3_BUCKET = process.env.S3_BUCKET || "draftgap";

if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
}

const octokit = new Octokit({
    auth: GITHUB_TOKEN,
});

// Api token is stored in the environment variable
export const client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
});

export async function main() {
    const latestRelease = await octokit.repos.getLatestRelease({
        owner: REPOSITORY_OWNER,
        repo: REPOSITORY_NAME,
    });

    const latestJsonBinary = await octokit.repos.getReleaseAsset({
        owner: REPOSITORY_OWNER,
        repo: REPOSITORY_NAME,
        asset_id: latestRelease.data.assets.find(
            (a) => a.name === "latest.json"
        )!.id,
        headers: {
            Accept: "application/octet-stream",
        },
    });

    const latestJsonString = new TextDecoder().decode(
        latestJsonBinary.data as unknown as ArrayBuffer
    );

    const latestJson = JSON.parse(latestJsonString);

    await storeReleaseAssetsInS3(latestRelease, latestJson);

    for (const platform of Object.values(latestJson.platforms) as any) {
        const url = new URL(platform.url);
        const fileName = url.pathname
            .split("/")
            .at(-1)!
            .replace(latestJson.version, "latest");
        platform.url = `${S3_PUBLIC_URL}/releases/${fileName}`;
    }

    const gistOctokit = new Octokit({
        auth: GIST_TOKEN,
    });
    await gistOctokit.gists.update({
        gist_id: GIST_ID,
        files: {
            "draftgap-tauri-update.json": {
                content: JSON.stringify(latestJson, null, 4),
            },
        },
    });

    console.log("Updated tauri update json");
}

export async function storeReleaseAssetsInS3(
    release: Awaited<ReturnType<typeof octokit.repos.getLatestRelease>>,
    latestJson: any
) {
    for (const asset of release.data.assets) {
        console.log(`Storing ${asset.name} in S3`);
        const res = await octokit.repos.getReleaseAsset({
            owner: REPOSITORY_OWNER,
            repo: REPOSITORY_NAME,
            asset_id: asset.id,
            headers: {
                Accept: "application/octet-stream",
            },
        });

        const assetBinary = res.data as unknown as ArrayBuffer;
        const assetName = asset.name.replace(latestJson.version, "latest");

        const params = {
            Bucket: S3_BUCKET,
            Key: `releases/${assetName}`,
            Body: new Uint8Array(assetBinary),
            ContentType: asset.content_type,
        } satisfies PutObjectCommandInput;

        const command = new PutObjectCommand(params);
        await client.send(command);
    }
}

main();
