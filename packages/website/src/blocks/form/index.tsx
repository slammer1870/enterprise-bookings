"use client";

import type {
  FormFieldBlock,
  Form as FormType,
} from "@payloadcms/plugin-form-builder/types";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@repo/ui/components/ui/form";

import { buildInitialFormState } from "../../utils/build-initial-form-state";

import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";

import { RichText } from "../../components/rich-text";

export type Value = unknown;

export interface Property {
  [key: string]: Value;
}

export interface Data {
  [key: string]: Property | Property[] | Value;
}

type FormField = {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  blockType?: string;
  defaultValue?: string;
};

export type FormBlockType = {
  blockName?: string;
  blockType?: "form-block";
  enableIntro: boolean;
  form: FormType & {
    fields: FormField[];
  };
  introContent?: {
    [k: string]: unknown;
  }[];
};

export const FormBlock: React.FC<
  FormBlockType & {
    id?: string;
  }
> = (props) => {
  const {
    enableIntro,
    form: formFromProps,
    form: {
      id: formID,
      confirmationMessage,
      confirmationType,
      redirect,
      submitButtonLabel,
    } = {},
    introContent,
  } = props;

  const formMethods = useForm({
    defaultValues: buildInitialFormState(formFromProps.fields),
  });
  const {
    control,
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
    setValue,
  } = formMethods;

  const [isLoading, setIsLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>();
  const [error, setError] = useState<
    { message: string; status?: string } | undefined
  >();
  const router = useRouter();

  const onSubmit = useCallback(
    (data: Data) => {
      let loadingTimerID: ReturnType<typeof setTimeout>;
      const submitForm = async () => {
        setError(undefined);

        const dataToSend = Object.entries(data).map(([name, value]) => ({
          field: name,
          value,
        }));

        // delay loading indicator by 1s
        loadingTimerID = setTimeout(() => {
          setIsLoading(true);
        }, 1000);

        try {
          const req = await fetch(
            `${process.env.NEXT_PUBLIC_SERVER_URL}/api/form-submissions`,
            {
              body: JSON.stringify({
                form: formID,
                submissionData: dataToSend,
              }),
              headers: {
                "Content-Type": "application/json",
              },
              method: "POST",
            }
          );

          const res = await req.json();

          clearTimeout(loadingTimerID);

          if (req.status >= 400) {
            setIsLoading(false);

            setError({
              message: res.errors?.[0]?.message || "Internal Server Error",
              status: res.status,
            });

            return;
          }

          setIsLoading(false);
          setHasSubmitted(true);

          if (confirmationType === "redirect" && redirect) {
            const { url } = redirect;

            const redirectUrl = url;

            if (redirectUrl) router.push(redirectUrl);
          }
        } catch (err) {
          console.warn(err);
          setIsLoading(false);
          setError({
            message: "Something went wrong.",
          });
        }
      };

      void submitForm();
    },
    [router, formID, redirect, confirmationType]
  );

  return (
    <div className="max-w-screen-sm mx-auto">
      {enableIntro && introContent && !hasSubmitted && (
        <RichText className="text-center" content={introContent} />
      )}
      {!isLoading && hasSubmitted && confirmationType === "message" && (
        <RichText className="text-center" content={confirmationMessage} />
      )}
      {isLoading && !hasSubmitted && <p>Loading, please wait...</p>}
      {error && <div>{`${error.status || "500"}: ${error.message || ""}`}</div>}
      {!hasSubmitted && (
        <Form {...formMethods}>
          <form
            id={formID}
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {formFromProps.fields.map((fieldBlock: FormField, index) => {
              const {
                name,
                label,
                required: requiredFromProps,
                type: typeFromProps,
                defaultValue,
              } = fieldBlock;
              return (
                <FormField
                  key={index}
                  control={control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium capitalize">
                        {label}
                      </FormLabel>
                      <FormControl>
                        {fieldBlock.blockType === "textarea" ? (
                          <Textarea
                            required={requiredFromProps}
                            placeholder={fieldBlock.defaultValue}
                            {...field}
                          />
                        ) : (
                          <Input
                            type={fieldBlock.blockType as string}
                            required={requiredFromProps}
                            placeholder={fieldBlock.defaultValue}
                            {...field}
                          />
                        )}
                      </FormControl>
                    </FormItem>
                  )}
                />
              );
            })}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : submitButtonLabel || "Submit"}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
};
