"use client";

import type { TextFieldClientProps } from "payload";

import {
  CopyToClipboard,
  SelectInput,
  useField,
  useFormFields,
} from "@payloadcms/ui";

import * as React from "react";

export const CustomSelect: React.FC<
  TextFieldClientProps & { apiUrl: string; dataLabel: string }
> = (props) => {
  const { path, field, apiUrl, dataLabel } = props;

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
    const getStripeOptions = async () => {
      try {
        const optionsFetch = await fetch(apiUrl, {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const res = await optionsFetch.json();

        if (res?.data) {
          const fetchedOptions = res.data.reduce(
            (
              acc: { label: any; value: any }[],
              item: {
                name: any;
                email: any;
                id: any;
                customer: { email: any };
              }
            ) => {
              acc.push({
                label:
                  item.name ||
                  item.email ||
                  (item.customer.email &&
                    `${item.customer.email} - ${item.id}`) ||
                  item.id,
                value: item.id,
              });
              return acc;
            },
            [
              {
                label: `Select a ${dataLabel}`,
                value: "",
              },
            ]
          );
          setOptions(fetchedOptions);
        }
      } catch (error) {
        console.error(error); // eslint-disable-line no-console
      }
    };

    void getStripeOptions();
  }, []);

  const href = `https://dashboard.stripe.com/${
    process.env.PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY ? "test/" : ""
  }${dataLabel}/${selectFieldValue}`;

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
        {`Select the related Stripe data or `}
        <a
          href={`https://dashboard.stripe.com/${
            process.env.PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY ? "test/" : ""
          }${dataLabel}/create`}
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
              }${dataLabel}/${selectFieldValue}`}
              rel="noreferrer noopener"
              target="_blank"
            >
              {href}
            </a>
          </div>
        </div>
      )}
      <span className="text-sm text-gray-900 font-medium mt-1">
        Please note, this input will display the 100 most recent {dataLabel}s in
        Stripe. If you need to input a {dataLabel} that is not in the list, you
        can create or find it in Stripe and then input the relevant ID here.
      </span>
    </div>
  );
};
