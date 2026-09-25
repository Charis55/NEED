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

interface WelcomeCustomerEmailProps {
  userName: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ? process.env.NEXT_PUBLIC_APP_URL : 'https://need-chi.vercel.app';

export const WelcomeCustomerEmail = ({
  userName = "Customer",
}: WelcomeCustomerEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome to NEED! Find trusted technicians instantly.</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brutalYellow: "#CCFF00",
                brutalBlue: "#00E5FF",
                brutalPink: "#FF00FF",
                brutalPurple: "#6A0DAD",
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
              Welcome to NEED
            </Heading>
            
            <Text className="text-black text-[16px] font-bold">
              Hi {userName},
            </Text>
            <Text className="text-black text-[16px] font-medium leading-[24px]">
              Welcome to NEED! We are thrilled to have you here. NEED is your go-to platform for connecting with verified, high-quality technicians in your area instantly.
            </Text>
            
            <Section className="bg-brutalBlue border-4 border-black p-4 my-6 shadow-[4px_4px_0_0_#000]">
              <Text className="text-black text-[14px] font-black uppercase m-0">
                What you can do right now:
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-2">
                • Search for trusted plumbers, electricians, mechanics, and more.
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-1">
                • Request jobs and negotiate prices transparently.
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-1">
                • Enjoy peace of mind knowing all our technicians are strictly vetted.
              </Text>
            </Section>

            <Section className="text-center mt-8 mb-4">
              <Button
                className="bg-brutalPurple border-4 border-black text-white font-black uppercase px-6 py-4 shadow-[4px_4px_0_0_#000] text-lg"
                href={`${baseUrl}/dashboard`}
              >
                FIND A TECHNICIAN
              </Button>
            </Section>

            <Text className="text-gray-500 text-[12px] font-bold mt-8 mb-0">
              Need help? Reply to this email or contact support.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default WelcomeCustomerEmail;
