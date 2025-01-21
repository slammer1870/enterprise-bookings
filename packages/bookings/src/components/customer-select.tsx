"use client";

import type { TextFieldClientProps } from "payload";

import {
  CopyToClipboard,
  Select,
  SelectInput,
  useField,
  useFormFields,
} from "@payloadcms/ui";

import * as React from "react";

export const CustomerSelect: React.FC<TextFieldClientProps> = (props) => {
  const { path, field } = props;

  const { label, name } = field;

  const { value, setValue } = useField<string>({ path });

  const [options, setOptions] = React.useState<
    {
      label: string;
      value: string;
    }[]
  >([]);

  const selectFieldValue = useFormFields(([fields]) => {
    return fields[path]?.value as string;
  });

  React.useEffect(() => {
    const getStripeCustomers = async () => {
      try {
        const customersFetch = await fetch(`/api/users/stripe-customers`, {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const res = await customersFetch.json();

        if (res?.data) {
          const fetchedCustomers = res.data.reduce(
            (
              acc: { label: any; value: any }[],
              item: { name: any; email: any; id: any }
            ) => {
              acc.push({
                label: item.name || item.email || item.id,
                value: item.id,
              });
              return acc;
            },
            [
              {
                label: "Select a customer",
                value: "",
              },
            ]
          );
          setOptions(fetchedCustomers);
        }
      } catch (error) {
        console.error(error); // eslint-disable-line no-console
      }
    };

    void getStripeCustomers();
  }, []);

  const href = `https://dashboard.stripe.com/${
    process.env.PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY ? "test/" : ""
  }customers/${selectFieldValue}`;

  return (
    <div>
      <p style={{ marginBottom: "0" }}>
        {typeof label === "string" ? label : "Customer"}
      </p>
      <p
        style={{
          color: "var(--theme-elevation-400)",
          marginBottom: "0.75rem",
        }}
      >
        {`Select the related Stripe customer or `}
        <a
          href={`https://dashboard.stripe.com/${
            process.env.PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY ? "test/" : ""
          }customers/create`}
          rel="noopener noreferrer"
          style={{ color: "var(--theme-text" }}
          target="_blank"
        >
          create a new one
        </a>
        .
      </p>
      <SelectInput
        path={path}
        name={name}
        options={options}
        value={value}
        onChange={(e: any) => setValue(e?.value)}
        className="mb-2"
      />
      {Boolean(selectFieldValue) && (
        <div>
          <div>
            <span
              className="label"
              style={{
                color: "#9A9A9A",
              }}
            >
              {`Manage "${
                options.find((option) => option.value === selectFieldValue)
                  ?.label || "Unknown"
              }" in Stripe`}
            </span>
            <CopyToClipboard value={href} />
          </div>
          <div
            style={{
              fontWeight: "600",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <a
              href={`https://dashboard.stripe.com/${
                process.env.PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY ? "test/" : ""
              }customers/${selectFieldValue}`}
              rel="noreferrer noopener"
              target="_blank"
            >
              {href}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
