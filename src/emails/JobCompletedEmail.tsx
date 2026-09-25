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

interface JobCompletedEmailProps {
  customerName: string;
  technicianName: string;
  trade: string;
  amount: number;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ? process.env.NEXT_PUBLIC_APP_URL : 'https://need-chi.vercel.app';

export const JobCompletedEmail = ({
  customerName = "Customer",
  technicianName = "Technician",
  trade = "Service",
  amount = 0,
}: JobCompletedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your job with {technicianName} is complete!</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brutalYellow: "#CCFF00",
                brutalBlue: "#00E5FF",
                brutalPink: "#FF00FF",
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
              Job Completed
            </Heading>
            
            <Text className="text-black text-[16px] font-bold">
              Hi {customerName},
            </Text>
            <Text className="text-black text-[16px] font-medium leading-[24px]">
              Your {trade} job with <span className="font-black bg-brutalBlue border-2 border-black px-1">{technicianName}</span> has been marked as complete.
            </Text>
            
            <Section className="bg-white border-4 border-black p-4 my-6 shadow-[4px_4px_0_0_#FF00FF]">
              <Text className="text-black text-[14px] font-black uppercase m-0 border-b-2 border-black pb-2 mb-2">
                Receipt Summary:
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-2">
                <span className="uppercase text-gray-500">Service:</span> {trade}
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-2">
                <span className="uppercase text-gray-500">Technician:</span> {technicianName}
              </Text>
              <Text className="text-black text-[18px] font-black m-0 mt-4 bg-brutalYellow inline-block px-2 border-2 border-black -rotate-1">
                TOTAL: ₦{amount.toLocaleString()}
              </Text>
            </Section>

            <Text className="text-black text-[16px] font-medium leading-[24px]">
              We hope you are satisfied with the work! Please take a moment to rate and review your technician. Your feedback helps keep the platform safe and reliable for everyone.
            </Text>

            <Section className="text-center mt-8 mb-4">
              <Button
                className="bg-black border-4 border-black text-white font-black uppercase px-6 py-4 shadow-[4px_4px_0_0_#CCFF00] text-lg"
                href={`${baseUrl}/dashboard`}
              >
                LEAVE A REVIEW
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

export default JobCompletedEmail;
