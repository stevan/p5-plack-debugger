package Plack::Debugger::Panel::Response;

use strict;
use warnings;

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'} ||= 'Plack Response';

    $args{'after'} = sub {
        my ($self, $env, $resp) = @_;

        $self->notify( $resp->[0] >= 400 ? 'error' : 'success' );
        $self->set_result([
            'Status'  => $resp->[0],
            'Headers' => { @{ $resp->[1] } }
        ]);
    };

    my $self = $class->SUPER::new( \%args );
    $self->add_metadata( formatter => 'ordered_key_value_pairs' );
    $self;

}

1;

__END__