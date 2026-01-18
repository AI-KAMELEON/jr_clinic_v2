# 🚀 GitHub Actions Setup dla Supabase Cron Jobs

## 📋 Instrukcja konfiguracji

### **1. Konfiguracja sekretów GitHub**

Przejdź do GitHub repository → Settings → Secrets and variables → Actions

Dodaj następujące sekrety:

#### **SUPABASE_URL**
```
https://cepvvyfayleasraezptd.supabase.co
```

#### **SUPABASE_ANON_KEY**
```
[Wstaw tutaj swój klucz ANON_KEY z dashboard Supabase]
```

#### **SUPABASE_SERVICE_ROLE_KEY**
```
[Wstaw tutaj swój klucz SERVICE_ROLE_KEY z dashboard Supabase]
```

### **2. Harmonogramy**

#### **Daily Reminder**
- **Czas:** Codziennie o 8:00 UTC (9:00 polskiego czasu)
- **Cron:** `0 8 * * *`
- **Funkcja:** `daily-reminder`

#### **Cron Test**
- **Czas:** Ręczne uruchomienie (workflow_dispatch)
- **Funkcja:** `cron-test`

### **3. Jak uruchomić ręcznie**

1. Przejdź do GitHub repository
2. Kliknij zakładkę **"Actions"**
3. Wybierz **"Supabase Cron Jobs"**
4. Kliknij **"Run workflow"**
5. Wybierz branch (main)
6. Kliknij **"Run workflow"**

### **4. Monitorowanie**

#### **Sprawdź logi:**
1. GitHub → Actions → Supabase Cron Jobs
2. Kliknij na ostatnie uruchomienie
3. Sprawdź logi każdego kroku

#### **Sprawdź w Supabase:**
1. Dashboard → Functions → Logs
2. Sprawdź czy funkcje zostały wywołane
3. Sprawdź tabele `cron_logs` i `sms_logs`

### **5. Dostosowanie harmonogramów**

Edytuj plik `.github/workflows/cron-jobs.yml`:

```yaml
schedule:
  # Codziennie o 6:00 UTC
  - cron: '0 6 * * *'
  # Co 2 godziny
  - cron: '0 */2 * * *'
  # Co minutę (tylko dla testów)
  - cron: '* * * * *'
```

### **6. Rozwiązywanie problemów**

#### **Błąd: "Secrets not found"**
- Sprawdź czy sekrety są poprawnie skonfigurowane
- Upewnij się, że nazwy sekretów są dokładnie takie same

#### **Błąd: "Function not found"**
- Sprawdź czy funkcje są wdrożone w Supabase
- Sprawdź czy URL jest poprawny

#### **Błąd: "Authorization failed"**
- Sprawdź czy SUPABASE_ANON_KEY jest poprawny
- Sprawdź czy klucz nie wygasł

### **7. Zalety GitHub Actions**

✅ **Niezawodność** - GitHub ma 99.9% uptime
✅ **Darmowe** - 2000 minut miesięcznie za darmo
✅ **Elastyczność** - Pełna kontrola nad harmonogramami
✅ **Monitoring** - Szczegółowe logi i historia
✅ **Integracja** - Łatwa integracja z kodem
✅ **Skalowalność** - Możliwość dodawania nowych jobs

### **8. Przykłady użycia**

#### **Różne harmonogramy:**
```yaml
# Codziennie o 8:00
- cron: '0 8 * * *'

# Co 2 godziny
- cron: '0 */2 * * *'

# W dni robocze o 9:00
- cron: '0 9 * * 1-5'

# Co minutę (testy)
- cron: '* * * * *'
```

#### **Różne funkcje:**
```yaml
# Daily reminder
daily-reminder

# SMS notifications
send-admin-sms

# Data cleanup
cleanup-old-logs

# Backup
backup-database
```

## 🎯 **Gotowe!**

Po skonfigurowaniu sekretów i push do GitHub, cron jobs będą działać automatycznie!
