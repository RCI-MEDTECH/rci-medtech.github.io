(() => {
  "use strict";

  const SUPABASE_FUNCTION_URL =
    "https://fmwjguncorvjmiguuths.supabase.co/functions/v1/submit-registration";

  // Esta é a chave publicável do projeto. Nunca inserir a Secret Key no navegador.
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_7I2_qLt6JBPu1yB3MKXQFg_73CbrU53";

  let turnstileToken = "";

  const form = document.getElementById("registrationForm");
  const statusBox = document.getElementById("registrationStatus");
  const submitButton = document.getElementById("registrationSubmit");

  if (!form || !statusBox || !submitButton) {
    console.error("Cadastro RCI MedTech: não foi possível localizar os elementos do formulário.");
    return;
  }

  function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = `registration-status is-${type}`;
  }

  // Callback global chamado pelo widget Turnstile após a validação.
  window.rciTurnstileSuccess = (token) => {
    turnstileToken = typeof token === "string" ? token : "";

    if (turnstileToken) {
      if (statusBox.classList.contains("is-security")) {
        showStatus("Verificação concluída. Você já pode enviar a solicitação.", "success");
      }
    } else {
      showStatus("A verificação não retornou um token válido. Faça-a novamente.", "security");
    }
  };

  window.rciTurnstileExpired = () => {
    turnstileToken = "";
    showStatus("A verificação de segurança expirou. Faça a verificação novamente.", "security");
  };

  window.rciTurnstileError = () => {
    turnstileToken = "";
    showStatus(
      "Não foi possível carregar a verificação de segurança. Atualize a página e tente novamente.",
      "error"
    );
  };

  function resetTurnstile() {
    turnstileToken = "";
    if (window.turnstile && typeof window.turnstile.reset === "function") {
      window.turnstile.reset();
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    if (!turnstileToken) {
      showStatus("Conclua a verificação de segurança antes de enviar.", "security");
      return;
    }

    const nationality = form.elements.nationality_code.value;
    const documentType = form.elements.document_type.value;

    if (nationality === "BR" && documentType !== "CPF") {
      showStatus("Para nacionalidade brasileira, selecione CPF como documento.", "error");
      return;
    }

    if (nationality !== "BR" && documentType === "CPF") {
      showStatus("Para esta nacionalidade, selecione CI ou passaporte.", "error");
      return;
    }

    const payload = {
      full_name: form.elements.full_name.value.trim(),
      email: form.elements.email.value.trim(),
      nationality_code: nationality,
      country_of_residence: form.elements.country_of_residence.value,
      document_type: documentType,
      document_number: form.elements.document_number.value.trim(),
      privacy_accepted: form.elements.privacy_accepted.checked,
      institution: form.elements.institution.value.trim() || null,
      reason: form.elements.reason.value.trim() || null,
      captcha_token: turnstileToken
    };

    submitButton.disabled = true;
    submitButton.textContent = "Enviando solicitação...";
    showStatus("Enviando seus dados com conexão segura...", "pending");

    try {
      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify(payload),
        mode: "cors",
        credentials: "omit"
      });

      let result = {};
      try {
        result = await response.json();
      } catch (_) {
        // A resposta pode não conter JSON.
      }

      if (!response.ok) {
        const message = result.error || "Não foi possível enviar a solicitação.";

        if (response.status === 409) {
          showStatus(
            message + " Se necessário, entre em contato com a equipe RCI MedTech.",
            "error"
          );
        } else if (response.status === 403) {
          showStatus(
            "A verificação de segurança não foi aprovada. Faça o CAPTCHA novamente.",
            "security"
          );
        } else {
          showStatus(message, "error");
        }

        resetTurnstile();
        return;
      }

      showStatus(
        "Solicitação recebida com sucesso! Ela será analisada pela administração. O envio ainda não representa aprovação ou criação de conta.",
        "success"
      );

      form.reset();
      resetTurnstile();
    } catch (error) {
      console.error("Erro ao enviar solicitação:", error);
      showStatus(
        "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
        "error"
      );
      resetTurnstile();
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Enviar solicitação →";
    }
  });
})();
