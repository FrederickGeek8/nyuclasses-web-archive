import path from "node:path";
import { cwd } from "node:process";
import readline from "node:readline";
import puppeteer, { Page } from "puppeteer";

// Populate this array with site URLs to ignored
const IGNORED_SITES = [];

/*
==== HELPER FUNCTIONS ====
*/
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const pressToContinue = () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question("Press Any Enter to Continue", (ans) => {
      rl.close();
      resolve(ans);
    })
  );
};
/*
==== END HELPER FUNCTIONS ====
*/

/*
==== ARCHIVAL FUNCTIONS ====
*/
const archiveSyllabus = async (page: Page, url: string) => {
  await page.goto(url);
  await delay(5000);
};

const archiveAnnouncements = async (page: Page, url: string) => {
  await page.goto(url);
  await delay(5000);

  const announcements = await Promise.all(
    await page
      .$$("[headers=subject] > strong > a")
      .then((r) =>
        r.map((elem) => elem.getProperty("href").then((e) => e.jsonValue()))
      )
  );

  for (const announce_link of announcements) {
    await page.goto(announce_link);
    await delay(5000);
  }
};

const archiveAssignments = async (page: Page, url: string) => {
  await page.goto(url);
  await delay(5000);

  const assignments: any[] = await Promise.all(
    await page
      .$$('[name="asnActionLink"]')
      .then((r) =>
        r.map((elem) => elem.getProperty("href").then((e) => e.jsonValue()))
      )
  );

  for (const assignment_url of assignments) {
    await page.goto(assignment_url);
    await delay(5000);

    // archive attachments
    const attachments = await Promise.all(
      await page
        .$$(".attachList > li > a")
        .then((r) =>
          r.map((elem) => elem.getProperty("href").then((e) => e.jsonValue()))
        )
    );

    for (const attachment of attachments) {
      // This can fail if the attachment is not web-friendly. It will download
      // to the "Downloads" folder instead.
      try {
        await page.goto(attachment);
        await delay(10000);
      } catch (error) {
        console.error(`Failed to fetch ${attachment} with error ${error}`);
      }
    }
  }
};

const archiveMemberPage = async (page: Page, url: string) => {
  await page.goto(url);
  await delay(5000);

  // We use try/catch here because these pages don't necessarily exist
  try {
    const announcementURL: any = await page
      .$('[title="Announcements "]')
      .then((e) => e.getProperty("href"))
      .then((e) => e.jsonValue());
    await archiveAnnouncements(page, announcementURL);
  } catch (error) {
    console.error(
      `Failed to fetch announcements for ${url} with error ${error}`
    );
  }

  try {
    const syllabusURL: any = await page
      .$('[title="Syllabus "]')
      .then((e) => e.getProperty("href"))
      .then((e) => e.jsonValue());
    await archiveSyllabus(page, syllabusURL);
  } catch (error) {
    console.error(`Failed to fetch syllabus for ${url} with error ${error}`);
  }

  try {
    const assignmentsURL: any = await page
      .$('[title="Assignments "]')
      .then((e) => e.getProperty("href"))
      .then((e) => e.jsonValue());
    await archiveAssignments(page, assignmentsURL);
  } catch (error) {
    console.error(`Failed to fetch assignments for ${url} with error ${error}`);
  }
};
/*
==== END ARCHIVAL FUNCTIONS ====
*/

/*
==== MAIN FUNCTION ====
*/
(async () => {
  const userDataDir = path.resolve(path.join(cwd(), "chrome-data"));
  console.log(`Storing Chrome session data in ${userDataDir}`);

  const browser = await puppeteer.launch({
    headless: false,
    args: [],
    userDataDir: userDataDir,
    ignoreDefaultArgs: [
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
    ],
  });

  const page: Page = await browser.newPage();
  await page.goto("https://newclasses.nyu.edu");

  await pressToContinue();

  await page.goto("https://newclasses.nyu.edu");

  const membership_lnk: any = await page
    .$('[title="My Memberships "]')
    .then((e) => e.getProperty("href"))
    .then((e) => e.jsonValue());

  console.log(membership_lnk);

  await page.goto(membership_lnk);
  await delay(1000);

  const memlinks = await page.$$("[headers=worksite] > a");

  var memberships = await Promise.all(
    memlinks.map((elem) => elem.getProperty("href").then((e) => e.jsonValue()))
  );
  memberships = memberships.filter(
    (value, index, array) => !IGNORED_SITES.includes(value)
  );

  console.log(memberships);

  for (const member of memberships) {
    await archiveMemberPage(page, member);
    await delay(5000);
  }

  await delay(10000);

  await browser.close();

  console.log("DONE ARCHIVING! CONGRATS!");
})();
/*
==== END MAIN FUNCTION ====
*/
