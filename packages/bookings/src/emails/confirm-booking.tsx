import {
  Body,
  Button,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { Booking, Lesson, Transaction, User } from "@repo/shared-types";
import * as React from "react";

interface BookingConfirmationEmailProps {
  user: User;
  lesson: Lesson;
  booking: Booking;
  transaction?: Transaction;
}

export const BookingConfirmationEmail = ({
  user,
  lesson,
  booking,
  transaction,
}: BookingConfirmationEmailProps) => {
  const formattedDate = new Date(lesson.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Format transaction amount if exists
  const formattedAmount = transaction
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "EUR",
      }).format(transaction.amount)
    : null;

  return (
    <Html>
      <Head />
      <Preview>Your Booking Confirmation</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={content}>
            <Heading style={heading}>Booking Confirmation</Heading>

            <Text style={paragraph}>Hi {user.name || "there"},</Text>

            <Text style={paragraph}>
              Thank you for your booking. Your reservation has been confirmed!
            </Text>

            <Section style={bookingDetails}>
              <Heading as="h2" style={subheading}>
                Booking Details
              </Heading>
              <Hr style={divider} />

              <Row style={detailRow}>
                <Column style={detailLabel}>Booking ID:</Column>
                <Column style={detailValue}>{booking.id}</Column>
              </Row>

              <Row style={detailRow}>
                <Column style={detailLabel}>Lesson:</Column>
                <Column style={detailValue}>{lesson.classOption.name}</Column>
              </Row>

              <Row style={detailRow}>
                <Column style={detailLabel}>Date:</Column>
                <Column style={detailValue}>{formattedDate}</Column>
              </Row>

              {lesson.startTime && lesson.endTime && (
                <Row style={detailRow}>
                  <Column style={detailLabel}>Time:</Column>
                  <Column style={detailValue}>
                    {lesson.startTime} - {lesson.endTime}
                  </Column>
                </Row>
              )}

              {lesson.location && (
                <Row style={detailRow}>
                  <Column style={detailLabel}>Location:</Column>
                  <Column style={detailValue}>{lesson.location}</Column>
                </Row>
              )}

              {lesson.instructor?.name && (
                <Row style={detailRow}>
                  <Column style={detailLabel}>Instructor:</Column>
                  <Column style={detailValue}>{lesson.instructor.name}</Column>
                </Row>
              )}
            </Section>

            {transaction && (
              <Section style={bookingDetails}>
                <Heading as="h2" style={subheading}>
                  Payment Information
                </Heading>
                <Hr style={divider} />

                <Row style={detailRow}>
                  <Column style={detailLabel}>Amount:</Column>
                  <Column style={detailValue}>{formattedAmount}</Column>
                </Row>

                <Row style={detailRow}>
                  <Column style={detailLabel}>Status:</Column>
                  <Column style={detailValue}>Paid</Column>
                </Row>
              </Section>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: "#f5f5f5",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0",
  maxWidth: "600px",
};

const logoContainer = {
  padding: "20px",
  textAlign: "center" as const,
};

const content = {
  backgroundColor: "#ffffff",
  padding: "30px",
  borderRadius: "4px",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
};

const heading = {
  fontSize: "24px",
  fontWeight: "bold",
  textAlign: "center" as const,
  color: "#333",
  margin: "0 0 20px",
};

const subheading = {
  fontSize: "18px",
  fontWeight: "bold",
  color: "#333",
  margin: "0 0 10px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "1.5",
  color: "#444",
  margin: "0 0 20px",
};

const bookingDetails = {
  margin: "20px 0",
  backgroundColor: "#f9f9f9",
  padding: "15px",
  borderRadius: "4px",
};

const detailRow = {
  margin: "8px 0",
};

const detailLabel = {
  width: "40%",
  fontWeight: "bold",
  color: "#555",
};

const detailValue = {
  width: "60%",
  color: "#333",
};

const divider = {
  borderColor: "#e5e5e5",
  margin: "15px 0",
};

const ctaContainer = {
  textAlign: "center" as const,
  margin: "30px 0",
};

const ctaButton = {
  backgroundColor: "#4a90e2",
  color: "#fff",
  borderRadius: "4px",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  padding: "12px 20px",
};

const footer = {
  fontSize: "14px",
  color: "#777",
  textAlign: "center" as const,
  margin: "20px 0 0",
};

export default BookingConfirmationEmail;
