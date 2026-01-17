"use client";

import type { TextFieldClientProps } from "payload";

import {
  CopyToClipboard,
  SelectInput,
  useField,
} from "@payloadcms/ui";

import * as React from "react";

export const CustomSelect: React.FC<
  TextFieldClientProps & { apiUrl: string; dataLabel: string }
> = (props) => {
  const { path, field, apiUrl, dataLabel } = props;

  const { label, name } = field;

  const { value, setValue } = useField<string>({ path });

  // Get initial value from props if available (from existing document data)
  const initialValue = (props as any).value || "";

  const [options, setOptions] = React.useState<
    {
      label: string;
      value: string;
    }[]
  >([]);

  // Use local state to track value, initialized from props
  // SelectInput will handle form updates via the path prop
  const didInitRef = React.useRef(false);

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
                  (item.customer?.email &&
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

  // Initialize field value from props on first mount (edit view hydration)
  React.useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    if (initialValue && typeof value === "undefined") setValue(initialValue);
  }, [initialValue, setValue, value]);

  const normalizedValue = typeof value === "string" ? value : "";

  const href = `https://dashboard.stripe.com/${
    process.env.NEXT_PUBLIC_STRIPE_IS_TEST_KEY ? "test/" : ""
  }${dataLabel}/${normalizedValue}`;

  return (
    <div className="mb-4">
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
            process.env.NEXT_PUBLIC_STRIPE_IS_TEST_KEY ? "test/" : ""
          }${dataLabel}/create`}
          rel="noopener noreferrer"
          style={{ color: "var(--theme-text)" }}
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
        value={normalizedValue}
        onChange={(e: any) => {
          const newValue = e?.value || "";
          setValue(newValue);
        }}
        className="mb-2"
      />
      {Boolean(normalizedValue) && (
        <div>
          <div>
            <span
              className="label"
              style={{
                color: "#9A9A9A",
              }}
            >
              {`Manage "${
                options.find((option) => option.value === normalizedValue)?.label ||
                "Unknown"
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
                process.env.NEXT_PUBLIC_STRIPE_IS_TEST_KEY ? "test/" : ""
              }${dataLabel}/${normalizedValue}`}
              rel="noreferrer noopener"
              target="_blank"
            >
              {href}
            </a>
          </div>
        </div>
      )}
      <p className="text-gray-900 mt-1">
        Please note, this input will display the{" "}
        <span className="font-bold">1000 most recent {dataLabel}</span> in
        Stripe. If you need to input a {dataLabel} that is not in the list, you
        can create or find it in Stripe and then input the relevant ID here.
      </p>
    </div>
  );
};
