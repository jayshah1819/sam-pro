package com.samtracker.messaging;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE = "installation-events";
    public static final String QUEUE = "installation-events.queue";
    // routing key used by the producer; # in the binding matches any suffix
    public static final String ROUTING_KEY = "installation.reported";

    @Bean
    TopicExchange installationEventsExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    @Bean
    Queue installationEventsQueue() {
        return new Queue(QUEUE, true);
    }

    @Bean
    Binding installationEventsBinding(Queue installationEventsQueue,
            TopicExchange installationEventsExchange) {
        return BindingBuilder.bind(installationEventsQueue)
                .to(installationEventsExchange)
                .with(ROUTING_KEY + ".#");
    }

    @Bean
    Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
            Jackson2JsonMessageConverter messageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);
        return template;
    }
}
