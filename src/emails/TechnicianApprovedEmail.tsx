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

interface TechnicianApprovedEmailProps {
  technicianName: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ? process.env.NEXT_PUBLIC_APP_URL : 'https://need-chi.vercel.app';

export const TechnicianApprovedEmail = ({
  technicianName = "Technician",
}: TechnicianApprovedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your NEED account has been approved!</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brutalYellow: "#CCFF00",
                brutalBlue: "#00E5FF",
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
              Hi {technicianName},
            </Text>
            <Text className="text-black text-[16px] font-medium leading-[24px]">
              Great news! Your profile and documents have been reviewed and
              approved. You are now a fully verified technician on the NEED
              platform.
            </Text>
            
            <Section className="bg-brutalYellow border-4 border-black p-4 my-6 shadow-[4px_4px_0_0_#000]">
              <Text className="text-black text-[14px] font-black uppercase m-0">
                You can now:
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-2">
                • Receive and accept job requests
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-1">
                • Negotiate prices directly with customers
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-1">
                • Start earning on your own terms
              </Text>
            </Section>

            <Section className="text-center mt-8 mb-4">
              <Button
                className="bg-[var(--color-brutal-teal)] border-4 border-black text-black font-black uppercase px-6 py-4 shadow-[4px_4px_0_0_#000] text-lg"
                href="https://need-chi.vercel.app/technician/dashboard"
              >
                GO TO DASHBOARD
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

export default TechnicianApprovedEmail;
