import * as dateformat from 'dateformat';

export class CancellationTerms {
    public static cancel_regexp(): RegExp {
        return /cancel.*|abort.*|deixa\s*p?r.*|desist.*|deixa\s*quieto|desencana|sair|sai/;
    }
}

export class CancellationResponder {
    public static cancelled(): string {
        return 'Processo cancelado com sucesso. Estou às ordens para novas solicitações!';
    }

    public static nothing_to_cancel(): string {
        return 'Não há nada em andamento para cancelar.';
    }
}

export class GenericResponder {
    public static not_trained_yet(): string {
        return 'Desculpe, ainda não estou treinado para atender a essa solicitação.';
    }

    public static could_not_understand(): string {
        return 'Desculpe, não consegui entender.';
    }

    public static unexpected_error(activityId: string): string {
        return `Ocorreu um erro inesperado. Por favor, tente novamente mais 
                tarde ou abra um chamado e informe o seguinte identificador 
                '${activityId}'`;
    }

    public static question_need_anything_else(): string {
        return 'Posso lhe ajudar em algo mais?';
    }

    public static thanks(): string {
        return 'Obrigado por usar nossos serviços!';
    }

    public static i_am_available(): string {
        return 'Estou à disposição, pode fazer sua nova solicitação.';
    }
}

export class ServiceDeskResponder {
    public static could_not_understand(): string {
        return 'Desculpe, entendi que você quer falar sobre service desk mas não entendi o que precisa efetivamente.';
    }
}

export class AccountPasswordFaqResponder {
    public static question_redirect_to_password_reset(): string {
        return `Gostaria de ajuda com o reset de sua senha?`;
    }
}

export class PasswordResetResponder {
    public static inform_user_id(userId: string): string {
        return `Entendi que seu id de usuário é o ${userId} e que você quer resetar sua senha.`;
    }

    public static user_id_prompt(): string {
        return 'Por favor informe seu email, alias ou id de funcionário'
    }

    public static user_id_reprompt(): string {
        return 'Id de usuário inválido. Por favor informe seu email, alias ou id de funcionário'
    }

    public static user_id_not_found(): string {
        return 'Usuário não encontrado.'
    }

    public static invalid_user_id_too_small(min: number): string {
        return `Id de usuário inválido. O id de usuário deve ter pelo menos ${min} caracteres.`;
    }

    public static invalid_user_id_too_big(max: number): string {
        return `Id de usuário inválido. O id de usuário deve ter no máximo ${max} caracteres.`;
    }

    public static inform_auth_prompt(mobileNumber): string {
        return `Para sua segurança precisamos autenticá-lo. Enviaremos um código por SMS para o telefone cadastrado (${mobileNumber}).`;
    }

    public static magic_code_prompt(): string {
        return 'Por favor entre com o código enviado por SMS';
    }

    public static invalid_magic_code(): string {
        return 'O código informado não é válido. Favor infomar o código enviado por SMS';
    }

    public static sms_message(magicCode: number): string {
        return `Seu codigo e ${magicCode}.`;
    }

    public static sms_message_password(password: string): string {
        return `Seu novo password e ${password}.`;
    }

    public static password_sent(): string {
        return `Uma nova senha foi gerada e enviada por SMS para você.`;
    }

    public static error_changing_password(): string {
        return `Erro ao alterar a senha. Por favor entre em contato com o help desk por telefone.`;
    }

    public static mobile_not_found(): string {
        return `Encontramos seu id de usuário porém você não possui celular cadastrado. Não é possível autenticá-lo. Favor ligar para o Help Desk.`;
    }
}

export class SupportTicketResponder {

    public static no_ticket_found_with_id(ticketId: string): string {
        return `Não foi possível encontrar nenhum ticket com id ${ticketId} criado pelo seu usuário`;
    }

    public static no_last_ticket_found(): string {
        return `Não foi possível encontrar nenhum ticket criado recentemente pelo seu usuário`;
    }

    public static no_last_open_tickets_found(): string {
        return `Não foi possível encontrar nenhum ticket criado recentemente pelo seu usuário`;
    }

    public static problem_statement_reprompt(): string {
        return `Não consegui entender. Pode entrar com seu problema novamente, por favor?`;
    }

    public static problem_statement_too_small(): string {
        return `Poderia entrar com um descritivo de seu problema um pouco maior, por favor?`;
    }

    public static problem_statement_prompt(): string {
        return `Favor entrar com uma descrição do problema`;
    }

    public static got_your_problem(problem: string): string {
        return `Ok, entendi que seu problema é '${problem}'`;
    }

    public static looking_for_solutions(problem: string): string {
        return `Estamos buscando soluções similares ao problema descrito: '${problem}'`;
    }

    public static link_desc(): string {
        return `Documento Completo`;
    }

    public static no_answer_found(): string {
        return `Não encontramos nenhuma resposta similar à sua pergunta`;
    }

    public static question_continue_opening_ticket(): string {
        return `Gostaria de continuar com a abertura do ticket?`;
    }

    public static inform_ticket_created(ticketId: string): string {
        return `Ticket ${ticketId} criado`;
    }

    public static ticket_card_ticket_id(ticketId: string): string {
        return `Ticket #${ticketId}`;
    }

    public static ticket_card_createdat(date: Date): string {
        return `Criado em ${dateformat(date, 'dd/mm/yyyy')}`;
    }

    public static ticket_card_creator(creator: string): string {
        return `Criado por ${creator}`;
    }

    public static ticket_card_status(status: number): string {
        switch (status) {
            case 0:
                return "Aberto"
            case 99:
                return "Fechado"
            default:
                return ""
        }
    }

    public static ticket_card_lastupdate_title(): string {
        return `Última atualização: `;
    }

    public static ticket_card_lastupdate(date: Date): string {
        return dateformat(date, 'dd/mm/yyyy');
    }
}

export class AuthResponder {
    public static hello_auth_user(displayName: string): string {
        return `Olá, ${displayName}`;
    }    

    public static auth_prompt(): string {
        return `Por favor efetue se autentique`;
    }

    public static auth_title(): string {
        return `Login`;
    }
}
