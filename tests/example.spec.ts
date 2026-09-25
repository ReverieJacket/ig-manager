import { test, expect, Page } from '@playwright/test';

test ('Instagram-Account-Creation', async({page}) => {
  await page.goto("https://www.instagram.com/accounts/emailsignup/");
  await page.getByLabel("Número de celular ou email").fill("fevib52856@blobapps.com"); // fills the email input
  await page.getByLabel("Senha").fill("t800@sky");  // fills the password input
  await page.getByRole('combobox', { name: 'Selecionar o dia' }).click();// clicks to open the dropdown for day
  await page.getByRole('option', {name: '6', exact: true}).click(); // clicks to select the option
  await page.getByRole('combobox', { name: 'Selecionar o mês' }).click(); // clicls dropdown for month
  await page.getByRole('option', {name: 'outubro', exact: true}).click(); // clicks to select the option
  await page.getByRole('combobox', { name: 'Selecionar o ano' }).click();// clicks to open year
  await page.getByRole('option', {name: '1995', exact: true}).click();  // clicks to select the option
  await page.getByLabel("Nome completo").fill("Zacarias Carangueijo"); // fills the full name input
  await page.getByLabel("Nome de usuário").fill("zacarias_carangueijo"); // fills the user name
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await waitForHumanIfCaptchaOnCreation(page);
})


async function waitForHumanIfCaptchaOnCreation(page: Page) {
  const captchaFrame = page.locator('#captcha-recaptcha');
  const confirmationCodeField = page.getByLabel('Código de confirmação');

  try {
    await captchaFrame.waitFor({ state: 'visible', timeout: 8000 });
  } catch {
    console.log('\n⏱️  No captcha appeared within 8s — timed out, continuing.\n');
    return;
  }

  console.log('\n🧩 Captcha detected — click it in the browser window.');
  console.log('   Waiting for it to clear before continuing...\n');

  await captchaFrame.waitFor({ state: 'hidden', timeout: 0 });

  console.log('✅ Captcha cleared — resuming.\n');
  await expect(confirmationCodeField).toBeVisible({ timeout: 15000 });
  console.log('✅ Reached the confirmation code step — captcha flow confirmed working.\n');
}

test.describe('with auth', () => {
  test.use({ storageState: 'auth.json' });

test.only("Instagram-Automated-Post-Creation", async({page}) =>{
  await page.goto("https://www.instagram.com/bots_at_meta/");
  await page.getByRole('link', { name: 'Instagram', exact: true }).hover();
  await page.getByRole('link', { name: 'Novo post Criar' }).click()
  await page.getByRole('presentation').locator('input[type="file"]').setInputFiles("C:/Users/mvini/Downloads/Disco elysium.jpg");
  await page.getByRole('button', { name: 'Avançar' }).click(); // consider opening for adjustment if the user needs to do it
  await page.getByRole('button', { name: 'Avançar' }).click();
  await page.getByRole('textbox', { name: 'Adicione uma legenda...' }).click();
  await page.getByRole('textbox', { name: 'Adicione uma legenda...' }).fill("Disco Elysium is the best CRPG ever made!!");
  await page.getByRole('button', { name: 'Compartilhar' }).click();
  await page.getByRole('button', { name: 'Concluir' }).click({ timeout: 15000 }); // configure use.actionTimeout/expect.timeout on playwright.config.ts

  await page.pause();

  })
});