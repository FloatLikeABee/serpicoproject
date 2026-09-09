package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func postJSON(r http.Handler, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestAdminCreateInvitesAreUniqueGenerated(t *testing.T) {
	r, _ := hardDataTestRouter(t)

	first := postJSON(r, "/api/v1/admin/invites", `{"note":"alice","username":"hacked","password":"typed"}`)
	if first.Code != http.StatusCreated && first.Code != http.StatusOK {
		t.Fatalf("first create %d: %s", first.Code, first.Body.String())
	}
	var a map[string]string
	if err := json.Unmarshal(first.Body.Bytes(), &a); err != nil {
		t.Fatal(err)
	}
	if len(a["code"]) < 32 {
		t.Fatalf("code too short: %q", a["code"])
	}
	if a["username"] == "serpico" || a["username"] == "hacked" {
		t.Fatalf("username not generated: %q", a["username"])
	}
	if a["password"] == "" || a["password"] == "typed" {
		t.Fatalf("password not generated: %q", a["password"])
	}

	second := postJSON(r, "/api/v1/admin/invites", `{}`)
	if second.Code != http.StatusCreated && second.Code != http.StatusOK {
		t.Fatalf("second create %d: %s", second.Code, second.Body.String())
	}
	var b map[string]string
	if err := json.Unmarshal(second.Body.Bytes(), &b); err != nil {
		t.Fatal(err)
	}
	if a["code"] == b["code"] || a["username"] == b["username"] {
		t.Fatalf("creates not distinct: %+v %+v", a, b)
	}
}

func TestAdminListInvitesAndPublicListHidden(t *testing.T) {
	r, _ := hardDataTestRouter(t)
	created := postJSON(r, "/api/v1/admin/invites", `{}`)
	var a map[string]string
	if err := json.Unmarshal(created.Body.Bytes(), &a); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/invites", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("list %d: %s", w.Code, w.Body.String())
	}
	var listed struct {
		Invites []map[string]string `json:"invites"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed.Invites) != 1 {
		t.Fatalf("want 1 invite, got %+v", listed.Invites)
	}
	got := listed.Invites[0]
	if got["code"] != a["code"] || got["username"] != a["username"] || got["password"] != a["password"] {
		t.Fatalf("list mismatch %+v vs %+v", got, a)
	}

	for _, path := range []string{"/api/v1/auth/invites", "/api/v1/invites"} {
		pub := httptest.NewRequest(http.MethodGet, path, nil)
		pw := httptest.NewRecorder()
		r.ServeHTTP(pw, pub)
		if pw.Code == http.StatusOK && strings.Contains(pw.Body.String(), a["code"]) {
			t.Fatalf("public list leaked secrets at %s: %s", path, pw.Body.String())
		}
	}
}

func TestRedeemSameCredentialsUnknownDoesNotCreateUser(t *testing.T) {
	r, db := hardDataTestRouter(t)
	created := postJSON(r, "/api/v1/admin/invites", `{}`)
	var a map[string]string
	if err := json.Unmarshal(created.Body.Bytes(), &a); err != nil {
		t.Fatal(err)
	}
	var before int
	if err := db.SQLite.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&before); err != nil {
		t.Fatal(err)
	}

	first := postJSON(r, "/api/v1/auth/redeem", `{"code":"`+a["code"]+`"}`)
	if first.Code != http.StatusOK {
		t.Fatalf("redeem %d: %s", first.Code, first.Body.String())
	}
	var r1 map[string]string
	if err := json.Unmarshal(first.Body.Bytes(), &r1); err != nil {
		t.Fatal(err)
	}
	second := postJSON(r, "/api/v1/auth/redeem", `{"code":"`+a["code"]+`"}`)
	var r2 map[string]string
	if err := json.Unmarshal(second.Body.Bytes(), &r2); err != nil {
		t.Fatal(err)
	}
	if r1["username"] != a["username"] || r1["password"] != a["password"] {
		t.Fatalf("first redeem %+v want %+v", r1, a)
	}
	if r1["username"] != r2["username"] || r1["password"] != r2["password"] {
		t.Fatalf("redeem not stable %+v %+v", r1, r2)
	}

	bad := postJSON(r, "/api/v1/auth/redeem", `{"code":"not-a-real-invite-code-zzzz"}`)
	if bad.Code == http.StatusOK {
		t.Fatalf("unknown code succeeded: %s", bad.Body.String())
	}
	var after int
	if err := db.SQLite.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if after != before {
		t.Fatalf("unknown redeem created users: %d -> %d", before, after)
	}
}

func TestRedeemRateLimit(t *testing.T) {
	r, _ := hardDataTestRouter(t)
	prev := redeemMaxAttempts
	redeemMaxAttempts = 3
	resetRedeemLimiter()
	t.Cleanup(func() {
		redeemMaxAttempts = prev
		resetRedeemLimiter()
	})

	created := postJSON(r, "/api/v1/admin/invites", `{}`)
	var a map[string]string
	_ = json.Unmarshal(created.Body.Bytes(), &a)

	var last *httptest.ResponseRecorder
	for i := 0; i < 4; i++ {
		last = postJSON(r, "/api/v1/auth/redeem", `{"code":"`+a["code"]+`"}`)
	}
	if last.Code == http.StatusOK {
		t.Fatalf("expected rate limit, got %d %s", last.Code, last.Body.String())
	}
}

func TestLoginDemoAndInvited(t *testing.T) {
	r, _ := hardDataTestRouter(t)

	demo := postJSON(r, "/api/v1/auth/login", `{"email":"serpico","password":"cops123"}`)
	if demo.Code != http.StatusOK {
		t.Fatalf("demo %d: %s", demo.Code, demo.Body.String())
	}
	var demoBody struct {
		User map[string]interface{} `json:"user"`
	}
	if err := json.Unmarshal(demo.Body.Bytes(), &demoBody); err != nil {
		t.Fatal(err)
	}
	if demoBody.User["id"] != "demo-serpico" {
		t.Fatalf("demo user %+v", demoBody.User)
	}

	created := postJSON(r, "/api/v1/admin/invites", `{}`)
	var a map[string]string
	if err := json.Unmarshal(created.Body.Bytes(), &a); err != nil {
		t.Fatal(err)
	}

	wrong := postJSON(r, "/api/v1/auth/login", `{"email":"`+a["username"]+`","password":"nope"}`)
	if wrong.Code != http.StatusUnauthorized {
		t.Fatalf("wrong password %d: %s", wrong.Code, wrong.Body.String())
	}

	ok := postJSON(r, "/api/v1/auth/login", `{"email":"`+a["username"]+`","password":"`+a["password"]+`"}`)
	if ok.Code != http.StatusOK {
		t.Fatalf("invited %d: %s", ok.Code, ok.Body.String())
	}
	var invited struct {
		User map[string]interface{} `json:"user"`
	}
	if err := json.Unmarshal(ok.Body.Bytes(), &invited); err != nil {
		t.Fatal(err)
	}
	if invited.User["id"] == "demo-serpico" || invited.User["role"] != "police" {
		t.Fatalf("invited user %+v", invited.User)
	}
	if invited.User["email"] != a["username"] {
		t.Fatalf("email %+v", invited.User)
	}
}
