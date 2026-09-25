import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Button,
  Tailwind,
  Section,
  Img,
} from "@react-email/components";
import * as React from "react";

interface AccountDeletedEmailProps {
  userName: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ? process.env.NEXT_PUBLIC_APP_URL : 'https://need-chi.vercel.app';

export const AccountDeletedEmail = ({
  userName = "User",
}: AccountDeletedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your NEED account has been successfully deleted.</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brutalYellow: "#CCFF00",
                brutalBlue: "#00E5FF",
                brutalRed: "#FF0033",
              },
            },
          },
        }}
      >
        <Body className="bg-[#FFF0E5] my-auto mx-auto font-sans">
          <Container className="border-4 border-black bg-white my-[40px] mx-auto p-[20px] max-w-xl shadow-[8px_8px_0_0_#000]">
            <Section className="text-center mt-[10px] mb-[20px]">
              <Img
                src={`${baseUrl}/LOGO.png`}
                width="120"
                alt="NEED Logo"
                className="mx-auto"
              />
            </Section>
            
            <Heading className="text-black text-[32px] font-black uppercase text-center p-0 mt-4 mb-8">
              Account Deleted
            </Heading>
            
            <Text className="text-black text-[16px] font-bold">
              Hi {userName},
            </Text>
            <Text className="text-black text-[16px] font-medium leading-[24px]">
              We are confirming that your NEED account and all associated personal data have been successfully permanently deleted from our systems.
            </Text>
            
            <Section className="bg-brutalRed border-4 border-black p-4 my-6 shadow-[4px_4px_0_0_#000]">
              <Text className="text-white text-[14px] font-black uppercase m-0">
                What this means:
              </Text>
              <Text className="text-white text-[14px] font-bold m-0 mt-2">
                • Your profile is no longer visible to anyone.
              </Text>
              <Text className="text-white text-[14px] font-bold m-0 mt-1">
                • Your personal information has been erased.
              </Text>
              <Text className="text-white text-[14px] font-bold m-0 mt-1">
                • You will no longer receive communications from us.
              </Text>
            </Section>

            <Text className="text-black text-[16px] font-medium leading-[24px]">
              We're sorry to see you go. If you ever need our services again, you can always create a new account.
            </Text>

            <Text className="text-gray-500 text-[12px] font-bold mt-8 mb-0">
              Need help? Reply to this email or contact support.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default AccountDeletedEmail;
