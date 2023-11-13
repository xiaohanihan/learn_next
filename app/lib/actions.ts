'use server';
import {z} from "zod";
import {sql} from "@vercel/postgres";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import { signIn } from '@/auth';

const InvoiceSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.'
    }),
    amount: z.coerce.number().gt(0, {message: 'Please enter an amount greater than $0.'}),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.'
    }),
    date: z.string()
})

const CreateInvoice = InvoiceSchema.omit({
    id: true,
    date: true
})

// This is temporary until @types/react-dom is updated
export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    const rawFormData = {
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    }
    const validatedFields = CreateInvoice.safeParse(rawFormData)
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    const {amount, customerId, status} = validatedFields.data

    const amountInCents = amount * 100
    const date = new Date().toISOString().split('T')[0]
    // Test it out:
    await sql`insert into invoices (customer_id, amount, status, date)
              values (${customerId}, ${amountInCents}, ${status}, ${date})`

    revalidatePath('/dashboard/invoices')
    redirect('/dashboard/invoices')

    return {
        errors: undefined,
        message: 'Created successfully'
    }
}

export async function updateInvoice(id: string, formData: FormData) {
    const {customerId, amount, status} = CreateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })
    const amountInCents = amount * 100

    await sql`update invoices
              set customer_id=${customerId},
                  amount=${amountInCents},
                  status=${status}
              where id = ${id}`
    revalidatePath('/dashboard/invoices')
    redirect('/dashboard/invoices')
}

export async function deleteInvoice(id: string) {
    try {
        await sql`delete
                  from invoices
                  where id = ${id} dd`
        return {message: 'Deleted Invoice'}
    } catch (e) {
        return {message: 'Database error: Failed to Delete Error'}
    }
    revalidatePath('/dashboard/invoices')
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', Object.fromEntries(formData));
    } catch (error) {
        if ((error as Error).message.includes('CredentialsSignin')) {
            return 'CredentialSignin';
        }
        throw error;
    }
}