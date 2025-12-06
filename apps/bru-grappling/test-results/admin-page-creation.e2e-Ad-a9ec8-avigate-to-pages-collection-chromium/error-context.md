# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - img [ref=e5]
    - generic [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]:
            - text: Email
            - generic [ref=e22]: "*"
          - textbox "Email *" [ref=e24]
        - generic [ref=e25]:
          - generic [ref=e26]:
            - text: Password
            - generic [ref=e27]: "*"
          - textbox "Password" [ref=e30]
      - link "Forgot password?" [ref=e31] [cursor=pointer]:
        - /url: /admin/forgot
      - button "Login" [ref=e33] [cursor=pointer]:
        - generic:
          - generic: Login
  - status [ref=e34]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e40] [cursor=pointer]:
    - img [ref=e41]
  - alert [ref=e44]
```