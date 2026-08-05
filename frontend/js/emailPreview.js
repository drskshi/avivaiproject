/**
 * Show Ethereal / SMTP email preview link + demo OTP when returned by API.
 */
function showEmailPreview(containerOrId, data) {
  const el = typeof containerOrId === 'string'
    ? document.getElementById(containerOrId)
    : containerOrId;
  if (!el || !data) return;

  const parts = [];
  if (data.demoOtp) {
    parts.push(`<p class="font-bold">Your code (demo): <span class="tracking-widest text-lg">${data.demoOtp}</span></p>`);
  }
  if (data.emailPreviewUrl) {
    parts.push(`
      <p class="mt-2">SMTP is not set to your inbox — open the test email here:</p>
      <a class="inline-flex mt-2 btn-secondary text-sm min-h-[44px]" href="${data.emailPreviewUrl}" target="_blank" rel="noopener">
        Open email preview
      </a>
    `);
  } else if (data.emailPreviewUrls?.length) {
    parts.push(`<p class="mt-2">Open ticket email preview(s):</p>`);
    data.emailPreviewUrls.forEach((url, i) => {
      parts.push(`<a class="block mt-2 text-rose-700 font-semibold underline break-all" href="${url}" target="_blank" rel="noopener">Ticket email ${i + 1}</a>`);
    });
  }

  if (!parts.length) return;
  el.innerHTML = `<div class="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">${parts.join('')}</div>`;
  el.classList.remove('hidden');
}

window.showEmailPreview = showEmailPreview;
