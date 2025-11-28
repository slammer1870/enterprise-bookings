import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface MagicLinkEmailProps {
  magicLink: string;
  userName?: string;
  appName?: string;
  expiryTime?: string;
}

export const MagicLinkEmail = ({
  magicLink,
  userName = "",
  appName = "Our App",
  expiryTime = "1 hour",
}: MagicLinkEmailProps) => {
  const greeting = userName ? `Hello, ${userName}` : "Hello";

  return (
    <Html>
      <Head />
      <Preview>Your magic link to sign in to {appName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Heading style={logo}>{appName}</Heading>
          </Section>
          <Section style={content}>
            <Heading style={heading}>{greeting}</Heading>
            <Text style={paragraph}>
              Someone requested a magic link to sign in to your {appName}{" "}
              account. Click the button below to sign in. This link expires in{" "}
              {expiryTime}.
            </Text>
            <Button style={button} href={magicLink}>
              Sign in to {appName}
            </Button>
            <Text style={paragraph}>
              If you didn't request this link, you can safely ignore this email.
            </Text>
            <Hr style={hr} />
            <Text style={footer}>
              If the button above doesn't work, paste this link into your
              browser:
            </Text>
            <Text style={link}>
              <Link href={magicLink} style={linkText}>
                {magicLink}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
  padding: "60px 0",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #eee",
  borderRadius: "5px",
  boxShadow: "0 5px 10px rgba(20, 50, 70, 0.2)",
  margin: "0 auto",
  maxWidth: "600px",
};

const logoContainer = {
  padding: "20px 0",
  borderBottom: "1px solid #eaeaea",
  textAlign: "center" as const,
};

const logo = {
  fontSize: "32px",
  fontWeight: "bold",
  color: "#000",
  textDecoration: "none",
  margin: "0",
};

const content = {
  padding: "40px 30px",
};

const heading = {
  fontSize: "22px",
  fontWeight: "bold",
  margin: "0 0 20px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "1.5",
  margin: "0 0 20px",
  color: "#444",
};

const button = {
  backgroundColor: "#5570f6",
  borderRadius: "5px",
  color: "#fff",
  display: "inline-block",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  margin: "15px 0 30px",
  padding: "10px 20px",
};

const hr = {
  borderColor: "#eaeaea",
  margin: "30px 0",
};

const footer = {
  fontSize: "14px",
  color: "#6c757d",
  margin: "0 0 10px",
};

const link = {
  fontSize: "14px",
  lineHeight: "1.4",
  margin: "0 0 20px",
  wordBreak: "break-all" as const,
};

const linkText = {
  color: "#5570f6",
  textDecoration: "none",
};

export default MagicLinkEmail;
