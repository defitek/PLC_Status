const form = document.querySelector('#login');
const error = document.querySelector('#login-error');
const passwordStep = document.querySelector('#password-step');
const mfaStep = document.querySelector('#mfa-step');
const description = document.querySelector('#login-description');
const submit = document.querySelector('#login-submit');
let challengeToken = '';

function resetPasswordStep() {
  challengeToken = '';
  passwordStep.classList.remove('hidden');
  mfaStep.classList.add('hidden');
  form.code.required = false;
  form.code.value = '';
  description.textContent = 'Zaloguj się, a następnie wybierz dostępny projekt';
  submit.textContent = 'Zaloguj';
  form.username.focus();
}

document.querySelector('#mfa-back').addEventListener('click', resetPasswordStep);
form.addEventListener('submit', async event => {
  event.preventDefault(); error.textContent = ''; submit.disabled = true;
  try {
    const endpoint = challengeToken ? '/api/login/mfa' : '/api/login';
    const body = challengeToken
      ? { challenge_token: challengeToken, code: form.code.value }
      : { username: form.username.value, password: form.password.value };
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (response.status === 202 && data.mfa_required) {
      challengeToken = data.challenge_token;
      passwordStep.classList.add('hidden'); mfaStep.classList.remove('hidden');
      form.code.required = true; description.textContent = 'Potwierdź logowanie kodem z aplikacji uwierzytelniającej'; submit.textContent = 'Potwierdź'; form.code.focus();
      return;
    }
    if (!response.ok) throw new Error(data.error || 'Nie udało się zalogować');
    location.href = '/';
  } catch (failure) { error.textContent = failure.message; if (challengeToken) resetPasswordStep(); }
  finally { submit.disabled = false; }
});
